import { Controller, Query, Get, Post, Patch } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { DateTime } from 'luxon';

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
    // console.log('controller:getStatus', start, end, group, start2, end2);

    const result = await this.transactionService.fetchTransactions(
      start,
      end,
      group,
      start2 && end2 ? { start: start2, end: end2 } : undefined, // 선택적 범위 전달
    );

    return result;
  }

  @Get('summary')
  async getSummary(
    @Query('start') start: string,
    @Query('end') end: string,
    @Query('timezone') timezone: string,
    @Query('network') network: string,
  ) {
    if (!start || !end) {
      throw new Error('Missing required parameters: start and end');
    }

    // start와 end가 올바른 형식인지 검증
    const startDate = DateTime.fromISO(start, { zone: timezone });
    const endDate = DateTime.fromISO(end, { zone: timezone });

    if (!startDate.isValid || !endDate.isValid) {
      throw new Error('Invalid DateTime format');
    }

    return await this.transactionService.generateDailyTransactionSummary(
      start,
      end,
      timezone,
      network,
    );
  }

  @Get('endpoints')
  async getEndpoints() {
    return await this.transactionService.getRPCEndpoints();
  }
}

