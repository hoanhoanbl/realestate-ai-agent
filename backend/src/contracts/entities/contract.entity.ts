import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// Hợp đồng đặt cọc. Vòng đời:
// DRAFTING (chờ n8n soạn) -> PENDING_APPROVAL (chờ quản lý duyệt) -> SENT (đã gửi khách ký) -> SIGNED
//                                         \-> REJECTED                      \-> EXPIRED
export const CONTRACT_STATUSES = ['DRAFTING', 'PENDING_APPROVAL', 'SENT', 'SIGNED', 'REJECTED', 'EXPIRED'];
// Hợp đồng còn hiệu lực: mỗi căn chỉ được có một hợp đồng ở các trạng thái này
export const ACTIVE_CONTRACT_STATUSES = ['DRAFTING', 'PENDING_APPROVAL', 'SENT', 'SIGNED'];
export const ACTIVE_CONTRACT_INDEX = 'uq_contracts_active_property';

@Entity('contracts')
@Index(ACTIVE_CONTRACT_INDEX, ['propertyId'], {
  unique: true,
  where: `status IN ('DRAFTING', 'PENDING_APPROVAL', 'SENT', 'SIGNED')`,
})
export class Contract {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'lead_id' })
  leadId: number;

  @Column({ name: 'property_id' })
  propertyId: number;

  @Column({ type: 'varchar', length: 200, nullable: true })
  title: string | null;

  // Nội dung hợp đồng (văn bản thuần, do n8n soạn từ mẫu)
  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ name: 'deposit_amount', type: 'bigint' })
  depositAmount: number;

  // Giá căn nhà tại thời điểm tạo hợp đồng
  @Column({ name: 'property_price', type: 'bigint' })
  propertyPrice: number;

  @Column({ type: 'varchar', length: 20, default: 'DRAFTING' })
  status: string;

  // JSON { riskLevel: LOW | MEDIUM | HIGH, notes: string[] } do n8n rà soát
  @Column({ name: 'ai_review', type: 'text', nullable: true })
  aiReview: string | null;

  @Column({ name: 'reject_reason', type: 'text', nullable: true })
  rejectReason: string | null;

  // Link để backend bấm "tiếp tục" lần chạy n8n đang chờ (quản lý duyệt, khách ký). Không trả ra API.
  @Column({ name: 'resume_url', type: 'text', nullable: true, select: false })
  resumeUrl: string | null;

  @Index({ unique: true })
  @Column({ name: 'sign_token', type: 'varchar', length: 64, nullable: true })
  signToken: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'approved_by', type: 'varchar', length: 100, nullable: true })
  approvedBy: string | null;

  @Column({ name: 'created_by', type: 'varchar', length: 100, nullable: true })
  createdBy: string | null;

  @Column({ name: 'signer_name', type: 'varchar', length: 200, nullable: true })
  signerName: string | null;

  // Ảnh chữ ký (data URL PNG). Chỉ trả ra ở trang chi tiết.
  @Column({ type: 'text', nullable: true, select: false })
  signature: string | null;

  @Column({ name: 'signed_at', type: 'timestamptz', nullable: true })
  signedAt: Date | null;

  @Column({ name: 'signed_ip', type: 'varchar', length: 64, nullable: true })
  signedIp: string | null;

  // Quản lý xác nhận đã nhận tiền cọc (chỉ khi hợp đồng đã ký)
  @Column({ name: 'deposit_received_at', type: 'timestamptz', nullable: true })
  depositReceivedAt: Date | null;

  @Column({ name: 'deposit_received_by', type: 'varchar', length: 100, nullable: true })
  depositReceivedBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
