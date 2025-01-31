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
    console.log('controller:getStatus', start, end, group, start2, end2);

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
    @Query('year') year: number,
    @Query('month') month: number,
    @Query('timezone') timezone: string,
    @Query('network') network: string,
  ) {
    // 로컬 시간 기준 월의 시작과 끝
    const startOfMonth = DateTime.fromObject(
      { year, month, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 },
      { zone: timezone },
    );
    const endOfMonth = startOfMonth.endOf('month');

    // `invalid` 체크 추가
    if (!startOfMonth.isValid || !endOfMonth.isValid) {
      throw new Error('Invalid DateTime conversion');
    }

    // UTC 변환
    const utcStartDate = startOfMonth.toUTC().toISO();
    const utcEndDate = endOfMonth.toUTC().toISO();

    return await this.transactionService.generateDailyTransactionSummary(
      utcStartDate,
      utcEndDate,
      timezone,
      network,
    );
  }

  @Get('endpoints')
  async getEndpoints() {
    return await this.transactionService.getRPCEndpoints();
  }
}

