import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('viewings')
export class Viewing {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  property_id: number;

  @Column()
  lead_id: number;

  @Column()
  viewing_time: Date;

  @Column()
  status: string;
}