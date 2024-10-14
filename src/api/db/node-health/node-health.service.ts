import { NodeHealthRepository } from "./node-health.repository";
import { Injectable } from "@nestjs/common";
import {NodeHealth} from "./node-health";
import { Not, Between, In, MoreThanOrEqual} from "typeorm"

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

  async getStatus() {
    const now = new Date();
    const oneMonthsAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let nodeHealths = await this.nodeHealthRepository.find({
      where: {
        timeStamp: MoreThanOrEqual(oneMonthsAgo),
        active: "false"
      }
    });

    const odinNodes = nodeHealths.filter(nodeHealth => nodeHealth.group_name === 'odin')
        .map(n => {
          n.timeStamp = new Date(n.timeStamp.getTime() + (9 * 60 * 60 * 1000)); // 9시간 추가
          return n;
        });

    const heimdallNodes = nodeHealths.filter(nodeHealth => nodeHealth.group_name === 'heimdall')
        .map(n => {
          n.timeStamp = new Date(n.timeStamp.getTime() + (9 * 60 * 60 * 1000)); // 9시간 추가
          return n;
        });

    return { "odin": odinNodes, "heimdall": heimdallNodes };
  }

  async getDetail(group: string, startTimeStamp: string, endTimeStamp: string) {
    const startDate = new Date(startTimeStamp);
    const endDate = new Date(endTimeStamp);
    startDate.setTime(startDate.getTime() - (9 * 60 * 60 * 1000)) // timestamp 때문에 이렇게 조회해야함. 나중에 수정하자. TODO
    endDate.setTime(endDate.getTime() - (9 * 60 * 60 * 1000));
    let nodeHealths = await this.nodeHealthRepository.find({
      where: {
        timeStamp: Between(startDate , endDate),
        active: "false",
        group_name: group //순서 고려해보자 인덱스
      }
    });
    return nodeHealths;
  }

  async getPendingTransactions() {
    return await this.nodeHealthRepository.find({ where: { active: In(["pending", "staging"])}});
  }

  async updateCompletedTx(id:number): Promise<void> {
    await this.nodeHealthRepository.update(id, { active: 'true' });
  }

  async updateStagingTx(id:number): Promise<void> {
    await this.nodeHealthRepository.update(id, { active: 'staging' });
  }

  async updateFailedTx(id:number, log): Promise<void> {
    await this.nodeHealthRepository.update(id, { active: 'false', log: log });
  }
}