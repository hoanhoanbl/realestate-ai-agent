import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

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

  @Column()
  status: string;
}