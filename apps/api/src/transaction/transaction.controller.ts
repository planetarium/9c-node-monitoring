import { Controller, Query, Get, Post, Patch } from '@nestjs/common';
import { TransactionService } from './transaction.service';

@Controller('transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post()
  async send() {
    return this.transactionService.sendTransactionToNodes();
  }

  @Patch('status')
  async updateStatus() {
    return await this.transactionService.updatePendingTransactions();
  }

  @Get('status')
  async getStatus(
    @Query('start') start: string,
    @Query('end') end: string,
    @Query('group') group?: string,
    @Query('start2') start2?: string,
    @Query('end2') end2?: string,
  ) {
    console.log('controller:getStatus', start, end, group, start2, end2);

    const result = await this.transactionService.fetchTransactions(
      start,
      end,
      group,
      start2 && end2 ? { start: start2, end: end2 } : undefined, // 선택적 범위 전달
    );

    return result;
  }

  @Get('status/summary')
  async getSummary(@Query('start') start: string, @Query('end') end: string) {
    return await this.transactionService.generateDailyTransactionSummary(
      new Date(start),
      new Date(end),
    );
  }

  @Get('endpoints')
  async getEndpoints() {
    return await this.transactionService.getRPCEndpoints();
  }
}

