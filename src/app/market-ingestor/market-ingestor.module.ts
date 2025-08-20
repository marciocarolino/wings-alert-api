import { Module } from '@nestjs/common';
import { MarketWsService } from './market-ws.service';

@Module({
  providers: [MarketWsService],
  exports: [MarketWsService],
})
export class MarketIngestorModule {}
