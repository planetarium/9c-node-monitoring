import { NodeHealthRepository } from "./node-health.repository";
import { Injectable } from "@nestjs/common";
import {NodeHealth} from "./node-health";

@Injectable()
export class NodeHealthService {
  constructor(private readonly nodeHealthRepository: NodeHealthRepository) {}

  async savePendingTx(group_name: string, endpoint_url: string, txHash: string): Promise<void> {
    const nodeHealth = new NodeHealth();
    nodeHealth.timeStamp = new Date();  // 현재 시간을 timestamp에 저장
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

  async updateCompletedTx(nodeHealth: NodeHealth): Promise<void> {
    await this.nodeHealthRepository.update(nodeHealth.id, { active: 'true' });
  }

  async updateFailedTx(nodeHealth: NodeHealth, log: string): Promise<void> {
    await this.nodeHealthRepository.update(nodeHealth.id, { active: 'false', log: log });
  }
}