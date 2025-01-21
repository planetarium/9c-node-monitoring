import { Controller, Get, Patch } from '@nestjs/common';
import { AccountService } from './account.service';

@Controller('accounts')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get('balance')
  async getBalance() {
    return this.accountService.getAllAccountBalances();
  }

  @Patch('balance')
  async updateBalance() {
    return this.accountService.updateAllAccountBalances();
  }
}
