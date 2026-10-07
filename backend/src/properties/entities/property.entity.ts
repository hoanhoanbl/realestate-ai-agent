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
}