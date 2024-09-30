import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";

@Entity({ name: 'sepolia' })
export class Sepolia extends BaseEntity{
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  address: string;

  @Column({ nullable: true })
  timeStamp: string;

  @Column({ nullable: true })
  nonce: number;

  @Column()
  txHash: string;

  @Column({ nullable: true })
  burnedTxHash: string;

  @Column()
  blockHash: string;

  @Column()
  request: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}