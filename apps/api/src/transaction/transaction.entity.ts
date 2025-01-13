import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('node_health')
export class Transaction {
  // 기존 프로젝트 entity 그대로 활용. 추후 필요에 따라 수정정
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  group_name: string;

  @Column()
  endpoint_url: string;

  @Index()
  @Column({ type: 'timestamp' })
  timeStamp: Date;

  @Column()
  txHash: string;

  @Column()
  active: string;

  @Column({ nullable: true })
  log: string;

  @UpdateDateColumn()
  updatedAt: Date;
}
