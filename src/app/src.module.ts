import { Module } from '@nestjs/common';

import { MarketIngestorModule } from './market-ingestor/market-ingestor.module';
import { RulesEngineModule } from './rules-engine/rules-engine.module';

@Module({
  imports: [MarketIngestorModule, RulesEngineModule],
  controllers: [],
  providers: [],
})
export class SrcModule {}
