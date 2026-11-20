import { Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { execFileSync } from 'child_process';
import { promises as fs, statSync } from 'fs';
import * as os from 'os';
import * as path from 'path';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { Contract } from '../entities/contract.entity';
import { Lead } from '../../leads/entities/lead.entity';
import { LeadEvent } from '../../leads/entities/lead-event.entity';
import { User } from '../../users/entities/user.entity';
import { Property } from '../../properties/entities/property.entity';
import { Viewing } from '../../viewings/entities/viewing.entity';
import { ChatLog } from '../../chat-logs/chat-log.entity';
import { Feedback } from '../../feedback/entities/feedback.entity';
import { FollowupTask } from '../../followups/followup-task.entity';
import { ContractsController, SignController } from '../contracts.controller';
import { ContractsService } from '../contracts.service';
import { ContractArchiveService } from './contract-archive.service';

// FE-48 nhóm 4: dịch vụ lưu bản đã ký. Chỉ chạy trên PostgreSQL tạm localhost:55433/fe33_test
// (cùng quy ước các bộ integration khác) và một thư mục tạm cho CONTRACT_ARCHIVE_DIR.
const databaseUrl = process.env.FE33_TEST_DATABASE_URL;
(databaseUrl ? describe : describe.skip)('FE-48: lưu bản đã ký (PostgreSQL và thư mục tạm)', () => {
  let db: DataSource;
  let archive: ContractArchiveService;
  let app: Awaited<ReturnType<typeof NestFactory.create>>;
  let token: string;
  let dir: string;
  const previousDir = process.env.CONTRACT_ARCHIVE_DIR;
  const pdf = (text: string) => Buffer.from(`%PDF-1.4\n${text}\n%%EOF\n`);

  beforeAll(async () => {
    const target = new URL(databaseUrl!);
    if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.port !== '55433' || target.pathname !== '/fe33_test') {
      throw new Error('Chỉ được chạy trên localhost:55433/fe33_test');
    }
    db = new DataSource({
      type: 'postgres', url: databaseUrl, synchronize: true,
      entities: [Contract, Lead, LeadEvent, User, Property, Viewing, ChatLog, Feedback, FollowupTask],
    });
    await db.initialize();
    archive = new ContractArchiveService(db.getRepository(Contract));
    const contracts = new ContractsService(
      db.getRepository(Contract), db.getRepository(Lead), db.getRepository(Viewing), db.getRepository(Property),
      {} as any, {} as any, archive,
    );
    const jwt = new JwtService({ secret: 'fe48-local-test-only' });
    @Module({
      controllers: [ContractsController, SignController],
      providers: [
        { provide: ContractsService, useValue: contracts },
        { provide: ContractArchiveService, useValue: archive },
        { provide: JwtService, useValue: jwt },
      ],
    })
    class HttpTestModule {}
    app = await NestFactory.create(HttpTestModule, { logger: false });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    token = await jwt.signAsync({ sub: 1, role: 'SALE', name: 'Sale', email: 's@example.test' });
  });
  afterAll(async () => {
    if (previousDir === undefined) delete process.env.CONTRACT_ARCHIVE_DIR;
    else process.env.CONTRACT_ARCHIVE_DIR = previousDir;
    await app?.close();
    if (db?.isInitialized) await db.destroy();
  });
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fe48-archive-'));
    process.env.CONTRACT_ARCHIVE_DIR = dir;
    await db.query('TRUNCATE contracts, lead_events, leads, properties RESTART IDENTITY CASCADE');
    await db.query(`INSERT INTO leads (name, phone) VALUES ('Khách thử', '0900000001')`);
    await db.query(`INSERT INTO properties (name, address, price, area, type, status) VALUES ('Nhà A', '1 Lê Lợi', 3000000000, 80, 'HOUSE', 'RESERVED')`);
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  const seed = async (status = 'SIGNED') => {
    const rows = await db.query(
      `INSERT INTO contracts (lead_id, property_id, deposit_amount, property_price, status, signer_name, signed_at)
       VALUES (1, 1, 100000000, 3000000000, $1, 'Lan', now()) RETURNING id`,
      [status],
    );
    return rows[0].id as number;
  };
  const row = async (id: number) =>
    (await db.query(
      `SELECT signed_file_path AS path, signed_file_sha256 AS sha, signed_file_stored_at AS "storedAt", status FROM contracts WHERE id = $1`,
      [id],
    ))[0];
  const events = (type = 'CONTRACT_ARCHIVED') =>
    db.query(`SELECT note FROM lead_events WHERE lead_id = 1 AND type = $1 ORDER BY id`, [type]);
  const files = () => fs.readdir(dir);
  const sha256sum = (file: string) => execFileSync('sha256sum', [file]).toString().split(' ')[0];

  describe('ContractArchiveService.store', () => {
    it('lưu lần đầu: có file HD-0001.pdf, mã băm khớp sha256sum, ba cột và một sự kiện CONTRACT_ARCHIVED', async () => {
      const id = await seed();
      const data = pdf('bản đã ký');
      const res = await archive.store(id, data, 'auto');
      expect(res).toMatchObject({ fileName: 'HD-0001.pdf', written: true, restoredBecause: null });
      expect(await files()).toEqual(['HD-0001.pdf']);
      const onDisk = path.join(dir, 'HD-0001.pdf');
      expect(await fs.readFile(onDisk)).toEqual(data);
      expect(res.sha256).toBe(sha256sum(onDisk));
      expect(res.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(statSync(onDisk).mode & 0o777).toBe(0o440);
      const r = await row(id);
      expect(r).toMatchObject({ path: 'HD-0001.pdf', sha: res.sha256, status: 'SIGNED' });
      expect(r.storedAt).toBeInstanceOf(Date);
      const ev = await events();
      expect(ev).toHaveLength(1);
      expect(ev[0].note).toContain('#1');
      expect(ev[0].note).toContain('HD-0001.pdf');
      expect(ev[0].note).toContain(res.sha256);
    });

    it('lưu lần hai (kể cả mode restore): không đổi file, mã băm, giờ lưu và không thêm sự kiện', async () => {
      const id = await seed();
      const first = await archive.store(id, pdf('một'), 'auto');
      const before = await row(id);
      const again = await archive.store(id, pdf('nội dung khác'), 'auto');
      const restoreOnIntact = await archive.store(id, pdf('nội dung khác nữa'), 'restore', 'Quản lý');
      expect(again).toMatchObject({ written: false, sha256: first.sha256 });
      expect(restoreOnIntact).toMatchObject({ written: false, sha256: first.sha256 });
      expect(await row(id)).toEqual(before);
      expect(await files()).toEqual(['HD-0001.pdf']);
      expect(await fs.readFile(path.join(dir, 'HD-0001.pdf'))).toEqual(pdf('một'));
      expect(await events()).toHaveLength(1);
    });

    it('hợp đồng chưa ký bị 409, không tạo file, không ghi cột hay sự kiện', async () => {
      for (const status of ['DRAFTING', 'PENDING_APPROVAL', 'SENT', 'REJECTED', 'EXPIRED']) {
        await db.query('TRUNCATE contracts RESTART IDENTITY CASCADE');
        const id = await seed(status);
        await expect(archive.store(id, pdf('x'), 'auto')).rejects.toMatchObject({ status: 409 });
        await expect(archive.store(id, pdf('x'), 'restore', 'Quản lý')).rejects.toMatchObject({ status: 409 });
        expect(await files()).toEqual([]);
        expect((await row(id)).sha).toBeNull();
        expect(await events()).toHaveLength(0);
      }
    });

    it('hợp đồng không tồn tại: 404; PDF rỗng: 400', async () => {
      await expect(archive.store(999, pdf('x'), 'auto')).rejects.toMatchObject({ status: 404 });
      const id = await seed();
      await expect(archive.store(id, Buffer.alloc(0), 'auto')).rejects.toMatchObject({ status: 400 });
    });

    it('hai lần gọi cùng lúc ra một file và một sự kiện', async () => {
      const id = await seed();
      const results = await Promise.all([archive.store(id, pdf('a'), 'auto'), archive.store(id, pdf('b'), 'auto')]);
      expect(results.filter((r) => r.written)).toHaveLength(1);
      expect(await files()).toHaveLength(1);
      expect(await events()).toHaveLength(1);
    });

    it('mode auto trên file đã sửa hoặc đã mất: 409, không đổi file, mã băm, giờ lưu hay sự kiện', async () => {
      const id = await seed();
      await archive.store(id, pdf('gốc'), 'auto');
      const before = await row(id);
      const target = path.join(dir, 'HD-0001.pdf');

      await fs.chmod(target, 0o640);
      await fs.writeFile(target, pdf('gốc bị sửa'));
      await expect(archive.store(id, pdf('mới'), 'auto')).rejects.toMatchObject({ status: 409 });
      expect(await fs.readFile(target)).toEqual(pdf('gốc bị sửa'));
      expect(await files()).toEqual(['HD-0001.pdf']);

      await fs.rm(target);
      await expect(archive.store(id, pdf('mới'), 'auto')).rejects.toMatchObject({ status: 409 });
      expect(await files()).toEqual([]);

      expect(await row(id)).toEqual(before);
      expect(await events()).toHaveLength(1);
    });

    it('mode restore trên file đã sửa: giữ file lệch .hong-<giờ UTC>, ghi file mới, sự kiện nêu người, "lệch" và hai mã băm', async () => {
      const id = await seed();
      const first = await archive.store(id, pdf('gốc'), 'auto');
      const target = path.join(dir, 'HD-0001.pdf');
      await fs.chmod(target, 0o640);
      await fs.writeFile(target, pdf('gốc bị sửa'));

      const res = await archive.store(id, pdf('dựng lại'), 'restore', 'Trần Quản Lý');
      expect(res).toMatchObject({ written: true, restoredBecause: 'MODIFIED' });
      expect(res.sha256).not.toBe(first.sha256);
      expect(await fs.readFile(target)).toEqual(pdf('dựng lại'));
      expect(res.sha256).toBe(sha256sum(target));

      const names = await files();
      const evidence = names.find((n) => /^HD-0001\.pdf\.hong-\d{8}T\d{6}Z/.test(n));
      expect(evidence).toBeDefined();
      expect(await fs.readFile(path.join(dir, evidence!))).toEqual(pdf('gốc bị sửa'));
      expect(names).toHaveLength(2);

      expect((await row(id)).sha).toBe(res.sha256);
      const ev = await events();
      expect(ev).toHaveLength(2);
      expect(ev[1].note).toContain('Trần Quản Lý');
      expect(ev[1].note).toContain('lệch');
      expect(ev[1].note).toContain(first.sha256);
      expect(ev[1].note).toContain(res.sha256);
      expect(ev[1].note).toContain(evidence!);
    });

    it('phục hồi hai lần liên tiếp không ghi đè chứng cứ của lần trước', async () => {
      const id = await seed();
      await archive.store(id, pdf('gốc'), 'auto');
      const target = path.join(dir, 'HD-0001.pdf');
      for (const bad of ['hỏng lần 1', 'hỏng lần 2']) {
        await fs.chmod(target, 0o640);
        await fs.writeFile(target, pdf(bad));
        await archive.store(id, pdf(`dựng lại sau ${bad}`), 'restore', 'Quản lý');
      }
      const evidence = (await files()).filter((n) => n.includes('.hong-'));
      expect(evidence).toHaveLength(2);
      const contents = await Promise.all(evidence.map((n) => fs.readFile(path.join(dir, n), 'utf8')));
      expect(contents.join('')).toContain('hỏng lần 1');
      expect(contents.join('')).toContain('hỏng lần 2');
    });

    it('mode restore trên file đã mất: ghi file mới, sự kiện lý do "mất", không có file chứng cứ', async () => {
      const id = await seed();
      const first = await archive.store(id, pdf('gốc'), 'auto');
      await fs.rm(path.join(dir, 'HD-0001.pdf'));

      const res = await archive.store(id, pdf('dựng lại'), 'restore', 'Quản lý');
      expect(res).toMatchObject({ written: true, restoredBecause: 'MISSING' });
      expect(await files()).toEqual(['HD-0001.pdf']);
      const ev = await events();
      expect(ev).toHaveLength(2);
      expect(ev[1].note).toContain('mất');
      expect(ev[1].note).toContain(first.sha256);
      expect(ev[1].note).toContain(res.sha256);
      expect((await archive.read(id))?.verified).toBe(true);
    });

    // Hậu review PR #94: DB từ chối ghi sự kiện (ngay lúc ghi, hoặc lúc COMMIT) thì file phải về như cũ,
    // để lần thử lại vẫn thấy bản lưu hỏng và ghi đủ sự kiện phục hồi.
    describe('DB từ chối sự kiện phục hồi', () => {
      const install = (deferred: boolean) =>
        db.query(`
          CREATE OR REPLACE FUNCTION fe48_reject_restore() RETURNS trigger AS $$
          BEGIN
            IF NEW.type = 'CONTRACT_ARCHIVED' AND NEW.note LIKE '%phục hồi%' THEN
              RAISE EXCEPTION 'fe48 test: từ chối sự kiện phục hồi';
            END IF;
            RETURN NEW;
          END $$ LANGUAGE plpgsql;
          DROP TRIGGER IF EXISTS fe48_reject ON lead_events;
          CREATE ${deferred ? 'CONSTRAINT' : ''} TRIGGER fe48_reject AFTER INSERT ON lead_events
            ${deferred ? 'DEFERRABLE INITIALLY DEFERRED' : ''} FOR EACH ROW EXECUTE FUNCTION fe48_reject_restore();
        `);
      const uninstall = () => db.query(`DROP TRIGGER IF EXISTS fe48_reject ON lead_events`);
      afterEach(uninstall);

      for (const when of ['ngay lúc ghi sự kiện', 'lúc COMMIT'] as const) {
        const deferred = when === 'lúc COMMIT';

        it(`file lệch, PDF phục hồi trùng bản gốc, bị từ chối ${when}: file lệch còn nguyên, thử lại vẫn ghi sự kiện`, async () => {
          const id = await seed();
          const original = pdf('gốc');
          const first = await archive.store(id, original, 'auto');
          const target = path.join(dir, 'HD-0001.pdf');
          await fs.chmod(target, 0o640);
          await fs.writeFile(target, pdf('gốc bị sửa'));
          const before = await row(id);

          await install(deferred);
          await expect(archive.store(id, original, 'restore', 'Quản lý')).rejects.toThrow();

          expect(await fs.readFile(target)).toEqual(pdf('gốc bị sửa'));
          expect(await files()).toEqual(['HD-0001.pdf']);
          expect(await row(id)).toEqual(before);
          expect(await events()).toHaveLength(1);
          expect(await archive.read(id)).toMatchObject({ verified: false, problem: 'MODIFIED' });

          await uninstall();
          const retry = await archive.store(id, original, 'restore', 'Quản lý');
          expect(retry).toMatchObject({ written: true, restoredBecause: 'MODIFIED', sha256: first.sha256 });
          const ev = await events();
          expect(ev).toHaveLength(2);
          expect(ev[1].note).toContain('Quản lý');
          expect(ev[1].note).toContain('lệch');
          expect((await files()).filter((n) => n.includes('.hong-'))).toHaveLength(1);
          expect((await archive.read(id))?.verified).toBe(true);
        });

        it(`file mất, PDF phục hồi trùng bản gốc, bị từ chối ${when}: không để lại file, thử lại vẫn ghi sự kiện`, async () => {
          const id = await seed();
          const original = pdf('gốc');
          const first = await archive.store(id, original, 'auto');
          await fs.rm(path.join(dir, 'HD-0001.pdf'));
          const before = await row(id);

          await install(deferred);
          await expect(archive.store(id, original, 'restore', 'Quản lý')).rejects.toThrow();

          expect(await files()).toEqual([]);
          expect(await row(id)).toEqual(before);
          expect(await events()).toHaveLength(1);
          expect(await archive.read(id)).toMatchObject({ verified: false, problem: 'MISSING' });

          await uninstall();
          const retry = await archive.store(id, original, 'restore', 'Quản lý');
          expect(retry).toMatchObject({ written: true, restoredBecause: 'MISSING', sha256: first.sha256 });
          const ev = await events();
          expect(ev).toHaveLength(2);
          expect(ev[1].note).toContain('mất');
          expect(await files()).toEqual(['HD-0001.pdf']);
        });
      }

      it('lưu lần đầu bị từ chối lúc COMMIT: không để lại file mồ côi, lần sau lưu bình thường', async () => {
        const id = await seed();
        await db.query(`
          CREATE OR REPLACE FUNCTION fe48_reject_restore() RETURNS trigger AS $$
          BEGIN RAISE EXCEPTION 'fe48 test: từ chối'; END $$ LANGUAGE plpgsql;
          DROP TRIGGER IF EXISTS fe48_reject ON lead_events;
          CREATE CONSTRAINT TRIGGER fe48_reject AFTER INSERT ON lead_events
            DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fe48_reject_restore();
        `);
        await expect(archive.store(id, pdf('gốc'), 'auto')).rejects.toThrow();
        expect(await files()).toEqual([]);
        expect((await row(id)).sha).toBeNull();
        await uninstall();
        expect(await archive.store(id, pdf('gốc'), 'auto')).toMatchObject({ written: true });
        expect(await events()).toHaveLength(1);
      });
    });

    it('cột đường dẫn bị sửa trong DB cũng không đọc hay đổi tên file ngoài thư mục lưu trữ', async () => {
      const id = await seed();
      await archive.store(id, pdf('gốc'), 'auto');
      const outside = path.join(os.tmpdir(), `fe48-outside-${Date.now()}.pdf`);
      await fs.writeFile(outside, pdf('ngoài'));
      try {
        await db.query(`UPDATE contracts SET signed_file_path = $2 WHERE id = $1`, [id, `../${path.basename(outside)}`]);
        // basename: đọc HD-... trong thư mục lưu trữ chứ không đọc file ngoài
        expect((await archive.read(id))?.buffer).toBeNull();
        expect(await fs.readFile(outside)).toEqual(pdf('ngoài'));
      } finally {
        await fs.rm(outside, { force: true });
      }
    });
  });

  describe('read và summary', () => {
    it('nguyên vẹn: verified true; sửa một byte: MODIFIED; xoá file: MISSING; chưa lưu: null', async () => {
      const id = await seed();
      expect(await archive.read(id)).toBeNull();
      expect(await archive.summary((await db.getRepository(Contract).findOneBy({ id }))!)).toBeNull();

      await archive.store(id, pdf('gốc'), 'auto');
      const target = path.join(dir, 'HD-0001.pdf');
      const contract = async () => (await db.getRepository(Contract).findOneBy({ id }))!;

      expect(await archive.read(id)).toMatchObject({ verified: true, problem: null, fileName: 'HD-0001.pdf' });
      expect(await archive.summary(await contract())).toMatchObject({ verified: true, problem: null });

      const bytes = await fs.readFile(target);
      bytes[10] ^= 0xff; // đổi đúng một byte
      await fs.chmod(target, 0o640);
      await fs.writeFile(target, bytes);
      expect(await archive.read(id)).toMatchObject({ verified: false, problem: 'MODIFIED' });
      expect(await archive.summary(await contract())).toMatchObject({ verified: false, problem: 'MODIFIED' });

      await fs.rm(target);
      expect(await archive.read(id)).toMatchObject({ verified: false, problem: 'MISSING', buffer: null });
      expect(await archive.summary(await contract())).toMatchObject({ verified: false, problem: 'MISSING' });
    });
  });

  describe('HTTP', () => {
    const get = (p: string) => request(app.getHttpServer()).get(p);
    const auth = (p: string) => get(p).auth(token, { type: 'bearer' });

    it('GET /contracts/:id/signed-file: 401 khi chưa đăng nhập, 404 khi chưa lưu', async () => {
      const id = await seed();
      const noLogin = await get(`/api/contracts/${id}/signed-file`).expect(401);
      expect(noLogin.headers['content-type']).not.toMatch(/pdf/);
      await auth(`/api/contracts/${id}/signed-file`).expect(404);
      await auth('/api/contracts/9999/signed-file').expect(404);
    });

    it('đã lưu: trả đúng byte, Content-Type application/pdf và X-Archive-Verified true', async () => {
      const id = await seed();
      const data = pdf('bản đã ký');
      await archive.store(id, data, 'auto');
      const res = await auth(`/api/contracts/${id}/signed-file`).buffer(true).parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      }).expect(200);
      expect(res.headers['content-type']).toMatch(/^application\/pdf/);
      expect(res.headers['x-archive-verified']).toBe('true');
      expect(res.headers['content-disposition']).toContain('HD-0001.pdf');
      expect(Buffer.compare(res.body, data)).toBe(0);
    });

    it('file bị sửa vẫn tải được nhưng X-Archive-Verified false; file mất thì 404', async () => {
      const id = await seed();
      await archive.store(id, pdf('gốc'), 'auto');
      const target = path.join(dir, 'HD-0001.pdf');
      await fs.chmod(target, 0o640);
      await fs.writeFile(target, pdf('đã sửa'));
      const res = await auth(`/api/contracts/${id}/signed-file`).expect(200);
      expect(res.headers['x-archive-verified']).toBe('false');
      await fs.rm(target);
      const missing = await auth(`/api/contracts/${id}/signed-file`).expect(404);
      expect(missing.body.message).toContain('thay đổi hoặc mất');
    });

    it('GET /contracts/:id: có khối archive, không lộ tên cột đường dẫn', async () => {
      const id = await seed();
      const before = await auth(`/api/contracts/${id}`).expect(200);
      expect(before.body.archive).toBeNull();
      expect(JSON.stringify(before.body)).not.toMatch(/signedFilePath|signed_file_path|HD-0001/);

      const stored = await archive.store(id, pdf('gốc'), 'auto');
      const ok = await auth(`/api/contracts/${id}`).expect(200);
      expect(ok.body.archive).toMatchObject({ sha256: stored.sha256, verified: true, problem: null });
      expect(ok.body.archive.storedAt).toBeTruthy();
      expect(JSON.stringify(ok.body)).not.toMatch(/signedFilePath|signed_file_path|HD-0001/);

      await fs.chmod(path.join(dir, 'HD-0001.pdf'), 0o640);
      await fs.writeFile(path.join(dir, 'HD-0001.pdf'), pdf('đã sửa'));
      const bad = await auth(`/api/contracts/${id}`).expect(200);
      expect(bad.body.archive).toMatchObject({ verified: false, problem: 'MODIFIED' });
    });
  });
});
