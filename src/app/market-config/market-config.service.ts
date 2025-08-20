import { Injectable } from '@nestjs/common';
import { MarketWsService } from '../market-ingestor/market-ws.service';

@Injectable()
export class MarketConfigService {
  constructor(private readonly market: MarketWsService) {}

  status() {
    return {
      symbols: this.market.getSymbols(),
      interval: this.market.getInterval(),
    };
  }

  setSymbols(symbols: string[], interval?: string) {
    return this.market.setConfig({ symbols, interval });
  }

  addSymbols(symbols: string[]) {
    return this.market.addSymbols(symbols);
  }

  removeSymbol(symbol: string) {
    return this.market.removeSymbol(symbol);
  }
}
