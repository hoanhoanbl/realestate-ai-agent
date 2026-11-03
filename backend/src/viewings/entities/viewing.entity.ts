import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Kết quả buổi xem. Mỗi khách (lead) chỉ có đúng một dòng viewing: hẹn lại thì sửa giờ trên dòng này.
// NEW (chờ xem) -> ATTENDED (khách có đến) | NO_SHOW (khách không đến, đã đóng) | CANCELLED (huỷ)
export const VIEWING_STATUSES = ['NEW', 'ATTENDED', 'NO_SHOW', 'CANCELLED'];

@Entity('viewings')
export class Viewing {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'property_id' })
  propertyId: number;

  @Column({ name: 'lead_id' })
  leadId: number;

  @Column({ name: 'viewing_time', type: 'timestamptz', nullable: true })
  viewingTime: Date;

  @Column({ default: 'NEW' })
  status: string;

  // Link cho khách tự huỷ / xin đổi lịch (/lich/<token>). Lịch cũ trước khi có cột này thì để trống.
  @Index({ unique: true })
  @Column({ name: 'manage_token', type: 'varchar', length: 64, nullable: true })
  manageToken: string | null;
}
