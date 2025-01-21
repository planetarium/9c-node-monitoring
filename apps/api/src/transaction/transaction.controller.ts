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
  ) {
    console.log('controller:getStatus', start, end, group);
    return await this.transactionService.fetchTransactions(start, end, group);
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

