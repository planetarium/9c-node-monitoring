import { Module } from '@nestjs/common';
import { TypeOrmExModule } from "../typeorm-ex.module";
import { SepoliaRepository } from "./sepolia.repository";
import { SepoliaService } from "./sepolia.service";


@Module({
  imports: [TypeOrmExModule.forCustomRepository([SepoliaRepository])],
  controllers: [],
  providers: [SepoliaService],
  exports: [SepoliaService],
})
export class SepoliaModule {}