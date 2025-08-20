import { Module } from '@nestjs/common';
import { MarketConfigController } from './market-config.controller';
import { MarketConfigService } from './market-config.service';
import { MarketIngestorModule } from '../market-ingestor/market-ingestor.module';

@Module({
  imports: [MarketIngestorModule],
  controllers: [MarketConfigController],
  providers: [MarketConfigService],
})
export class MarketConfigModule {}
