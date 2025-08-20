import { Module } from '@nestjs/common';
import { RulesController } from './rules.controller';
import { RulesService } from './rules.service';
import { MarketIngestorModule } from '../market-ingestor/market-ingestor.module';

@Module({
  imports: [MarketIngestorModule],
  controllers: [RulesController],
  providers: [RulesService],
})
export class RulesModule {}
