import { Module } from '@nestjs/common';

import { MarketIngestorModule } from './market-ingestor/market-ingestor.module';
import { RulesEngineModule } from './rules-engine/rules-engine.module';
import { MarketConfigModule } from './market-config/market-config.module';
import { RulesModule } from './rules/rules.module';

@Module({
  imports: [
    RulesModule,
    MarketIngestorModule,
    RulesEngineModule,
    MarketConfigModule,
  ],
  controllers: [],
  providers: [],
})
export class SrcModule {}
