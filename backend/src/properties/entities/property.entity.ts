import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('properties')
export class Property {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  address: string;

  @Column('bigint')
  price: number;

  @Column('decimal')
  area: number;

  @Column()
  type: string;

  @Column()
  status: string;

  // Link ảnh đại diện (http/https). Trống thì web hiện nền theo loại nhà
  @Column({ name: 'image_url', type: 'text', nullable: true })
  imageUrl: string | null;

  // Mô tả cho khách đọc, sau này dùng làm nguồn cho RAG
  @Column({ type: 'text', nullable: true })
  description: string | null;
}