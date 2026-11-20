import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Contract } from '../entities/contract.entity';
import { LeadEvent } from '../../leads/entities/lead-event.entity';

// 'auto': luồng 3 (webhook). 'restore': quản lý bấm "Lưu lại bản đã ký", được phục hồi có dấu vết.
export type ArchiveMode = 'auto' | 'restore';
// MISSING: file không còn. MODIFIED: file còn nhưng SHA-256 tính lại khác mã đã lưu.
export type ArchiveProblem = 'MISSING' | 'MODIFIED';

export interface ArchiveResult {
  fileName: string;
  sha256: string;
  storedAt: Date;
  // false khi bản lưu cũ còn nguyên vẹn nên không ghi gì
  written: boolean;
  // có giá trị khi lần lưu này là phục hồi một bản lưu hỏng
  restoredBecause: ArchiveProblem | null;
}

export interface ArchiveSummary {
  sha256: string;
  storedAt: Date | null;
  verified: boolean;
  problem: ArchiveProblem | null;
}

export const ARCHIVE_BROKEN_MESSAGE = 'Bản lưu đã bị thay đổi hoặc mất, cần quản lý phục hồi';

const LABEL: Record<ArchiveProblem, string> = { MISSING: 'mất', MODIFIED: 'lệch' };

const sha256Of = (data: Buffer) => crypto.createHash('sha256').update(data).digest('hex');

// Lưu file PDF bản đã ký ra thư mục riêng (volume Docker), kèm SHA-256 để phát hiện file bị sửa.
// Tên file do hệ thống đặt (HD-<mã>.pdf), không lấy từ dữ liệu người dùng.
@Injectable()
export class ContractArchiveService {
  private readonly logger = new Logger(ContractArchiveService.name);

  constructor(
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
  ) {}

  // Đọc mỗi lần gọi để đổi biến môi trường (và test) có hiệu lực ngay
  private dir(): string {
    return path.resolve(process.env.CONTRACT_ARCHIVE_DIR || './storage/contracts');
  }

  static fileNameFor(contractId: number): string {
    return `HD-${String(contractId).padStart(4, '0')}.pdf`;
  }

  // basename để cột `signed_file_path` có bị sửa trong DB cũng không thoát khỏi thư mục lưu trữ
  private resolveFile(fileName: string): string {
    return path.join(this.dir(), path.basename(fileName));
  }

  // null khi file không tồn tại; lỗi khác (quyền, ổ đĩa) được ném lên
  private async tryRead(fileName: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(this.resolveFile(fileName));
    } catch (err: any) {
      if (err?.code === 'ENOENT') return null;
      throw err;
    }
  }

  private check(file: Buffer | null, expectedSha: string): ArchiveProblem | null {
    if (file === null) return 'MISSING';
    return sha256Of(file) === expectedSha ? null : 'MODIFIED';
  }

  // Ghi vào file tạm rồi đổi tên: người đọc không bao giờ thấy file ghi dở
  private async writeAtomic(fileName: string, data: Buffer): Promise<void> {
    await fs.mkdir(this.dir(), { recursive: true, mode: 0o750 });
    const target = this.resolveFile(fileName);
    const tmp = `${target}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
    try {
      await fs.writeFile(tmp, data, { mode: 0o440, flag: 'wx' });
      await fs.rename(tmp, target);
    } catch (err) {
      await fs.rm(tmp, { force: true }).catch(() => undefined);
      throw err;
    }
  }

  // Chọn tên cho file lệch giữ làm chứng cứ: HD-0007.pdf.hong-20261120T031500Z (thêm -2, -3 nếu trùng giờ).
  // Chỉ chọn tên, chưa đổi tên file, để tên được ghi vào sự kiện trước khi đụng tới ổ đĩa.
  private async pickEvidenceName(fileName: string): Promise<string> {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    for (let n = 1; ; n++) {
      const name = `${path.basename(fileName)}.hong-${stamp}${n > 1 ? `-${n}` : ''}`;
      const taken = await fs.access(this.resolveFile(name)).then(() => true, () => false);
      if (!taken) return name;
    }
  }

  // Lưu bản đã ký. Chỉ hợp đồng SIGNED. Khoá dòng hợp đồng nên hai lần gọi cùng lúc được xếp hàng.
  //  - Chưa có mã băm: ghi file, cập nhật ba cột, ghi sự kiện CONTRACT_ARCHIVED.
  //  - Đã có mã băm, file còn và khớp: trả bản hiện có, không ghi gì (gọi lại an toàn).
  //  - Đã có mã băm, file mất hoặc lệch: 'auto' bị 409 và không đổi gì; 'restore' giữ file lệch
  //    làm chứng cứ, ghi file mới và ghi sự kiện nêu người phục hồi, lý do, mã băm cũ và mới.
  // Thứ tự: ghi DB trước (cột và sự kiện), đụng ổ đĩa sau cùng. DB từ chối thì ổ đĩa chưa đổi gì.
  // Ổ đĩa không nằm trong transaction nên mỗi bước đổi file đăng ký một bước hoàn lại; nếu việc đổi file
  // hay chính lệnh COMMIT thất bại, các bước hoàn lại chạy ngược để file về đúng như trước và lần thử lại
  // thấy đúng tình trạng cũ (vẫn ghi đủ sự kiện phục hồi), không gặp file đã "tự lành" mà không có dấu vết.
  async store(contractId: number, pdf: Buffer, mode: ArchiveMode, actorName?: string): Promise<ArchiveResult> {
    if (!Buffer.isBuffer(pdf) || pdf.length === 0) throw new BadRequestException('Nội dung PDF rỗng');

    const undo: Array<() => Promise<void>> = [];
    try {
      return await this.contractRepository.manager.transaction(async (em) => {
        const rows: { status: string; leadId: number; path: string | null; sha: string | null; storedAt: Date | null }[] =
          await em.query(
            `SELECT status, lead_id AS "leadId", signed_file_path AS "path", signed_file_sha256 AS "sha",
                    signed_file_stored_at AS "storedAt"
               FROM contracts WHERE id = $1 FOR UPDATE`,
            [contractId],
          );
        if (rows.length === 0) throw new NotFoundException(`Contract with id ${contractId} not found`);
        const c = rows[0];
        if (c.status !== 'SIGNED') throw new ConflictException('Hợp đồng chưa ký, không lưu trữ được');

        const fileName = ContractArchiveService.fileNameFor(contractId);
        let problem: ArchiveProblem | null = null;
        let evidenceName: string | null = null;

        if (c.sha) {
          const existing = c.path ? await this.tryRead(c.path) : null;
          problem = this.check(existing, c.sha);
          if (problem === null) {
            return { fileName: c.path as string, sha256: c.sha, storedAt: c.storedAt as Date, written: false, restoredBecause: null };
          }
          // Một file đã bị sửa không bao giờ được âm thầm coi là bản đúng
          if (mode === 'auto') throw new ConflictException(ARCHIVE_BROKEN_MESSAGE);
          if (problem === 'MODIFIED') evidenceName = await this.pickEvidenceName(c.path as string);
        }

        const sha256 = sha256Of(pdf);
        const storedAt = new Date();
        const note =
          problem === null
            ? `Hợp đồng #${contractId} đã lưu bản đã ký: ${fileName}, SHA-256 ${sha256}`
            : `Hợp đồng #${contractId} được phục hồi bản lưu bởi ${actorName ?? 'không rõ'}: bản cũ ${LABEL[problem]}, ` +
              `mã băm cũ ${c.sha}, mã băm mới ${sha256}, file mới ${fileName}` +
              (evidenceName ? `, file lệch giữ lại: ${evidenceName}` : '');

        // 1) DB trước: nếu sự kiện bị từ chối thì chưa file nào bị đổi
        await em.query(
          `UPDATE contracts SET signed_file_path = $2, signed_file_sha256 = $3, signed_file_stored_at = $4, updated_at = now()
            WHERE id = $1`,
          [contractId, fileName, sha256, storedAt],
        );
        await em.getRepository(LeadEvent).save({ leadId: c.leadId, type: 'CONTRACT_ARCHIVED', note });

        // 2) Ổ đĩa sau, mỗi bước đổi xong thì đăng ký cách hoàn lại
        if (evidenceName) {
          const original = c.path as string;
          await fs.rename(this.resolveFile(original), this.resolveFile(evidenceName));
          undo.push(() => fs.rename(this.resolveFile(evidenceName as string), this.resolveFile(original)));
        }
        const previous = await this.tryRead(fileName);
        await this.writeAtomic(fileName, pdf);
        undo.push(async () => {
          if (previous === null) await fs.rm(this.resolveFile(fileName), { force: true });
          else await this.writeAtomic(fileName, previous);
        });

        return { fileName, sha256, storedAt, written: true, restoredBecause: problem };
      });
    } catch (err) {
      // Lỗi ở bất kỳ bước nào, kể cả COMMIT: đưa ổ đĩa về như trước khi gọi
      for (const step of undo.reverse()) {
        await step().catch((undoErr: any) =>
          this.logger.error(`Không hoàn lại được thay đổi file của hợp đồng #${contractId}: ${undoErr?.message}`),
        );
      }
      throw err;
    }
  }

  // Tải file kèm kết quả kiểm. null khi hợp đồng chưa được lưu bản nào; buffer null khi file đã mất.
  async read(contractId: number): Promise<{
    fileName: string;
    buffer: Buffer | null;
    verified: boolean;
    problem: ArchiveProblem | null;
  } | null> {
    const contract = await this.contractRepository.findOne({ where: { id: contractId } });
    if (!contract) throw new NotFoundException(`Contract with id ${contractId} not found`);
    if (!contract.signedFileSha256 || !contract.signedFilePath) return null;
    const buffer = await this.tryRead(contract.signedFilePath);
    const problem = this.check(buffer, contract.signedFileSha256);
    return { fileName: contract.signedFilePath, buffer, verified: problem === null, problem };
  }

  // Cho trang chi tiết: không trả đường dẫn. Lỗi đọc ổ đĩa không làm hỏng trang, chỉ báo "mất".
  async summary(
    contract: Pick<Contract, 'signedFilePath' | 'signedFileSha256' | 'signedFileStoredAt'>,
  ): Promise<ArchiveSummary | null> {
    if (!contract.signedFileSha256) return null;
    let buffer: Buffer | null = null;
    try {
      buffer = contract.signedFilePath ? await this.tryRead(contract.signedFilePath) : null;
    } catch (err: any) {
      this.logger.warn(`Không đọc được bản lưu ${contract.signedFilePath}: ${err?.message}`);
    }
    const problem = this.check(buffer, contract.signedFileSha256);
    return {
      sha256: contract.signedFileSha256,
      storedAt: contract.signedFileStoredAt,
      verified: problem === null,
      problem,
    };
  }
}
