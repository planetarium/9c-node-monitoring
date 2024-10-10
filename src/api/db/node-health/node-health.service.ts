import { NodeHealthRepository } from "./node-health.repository";
import { Injectable } from "@nestjs/common";
import {NodeHealth} from "./node-health";

@Injectable()
export class NodeHealthService {
  constructor(private readonly nodeHealthRepository: NodeHealthRepository) {}

  async savePendingTx(group_name: string, endpoint_url: string, txHash: string, timeStamp: Date): Promise<void> {
    const nodeHealth = new NodeHealth();
    nodeHealth.timeStamp = timeStamp;  // 현재 시간을 timestamp에 저장
    nodeHealth.txHash = txHash;
    nodeHealth.group_name = group_name;
    nodeHealth.endpoint_url = endpoint_url;
    nodeHealth.active = 'pending';
    try {
      await this.nodeHealthRepository.save(nodeHealth);
    } catch (error) {
      console.error(error);
    }
  }

  async getPendingTransactions() {
    return await this.nodeHealthRepository.find({ where: { active: "pending" }});
  }

  async updateCompletedTx(id:number): Promise<void> {
    await this.nodeHealthRepository.update(id, { active: 'true' });
  }

  async updateFailedTx(id:number, log): Promise<void> {
    await this.nodeHealthRepository.update(id, { active: 'false', log: log });
  }
}