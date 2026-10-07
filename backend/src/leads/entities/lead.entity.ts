import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('leads')
export class Lead {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  email: string;

  @Column()
  phone: string;

  @Column('bigint')
  budget: number;

  @Column({ type: 'text', nullable: true })
  needs: string | null;

  @Column({ type: 'integer', nullable: true })
  score: number | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  level: string | null;

  @Column({ type: 'varchar', length: 50, default: 'NEW' })
  status: string;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
  })
  createdAt: Date;
}