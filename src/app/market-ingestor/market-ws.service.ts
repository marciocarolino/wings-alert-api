/* eslint-disable @typescript-eslint/no-base-to-string */
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WebSocket } from 'ws';
import type { RawData } from 'ws';

type KlineMsg = {
  stream?: string;
  data?: {
    e: 'kline';
    E: number; // event time
    s: string; // symbol
    k: {
      t: number; // open time
      T: number; // close time
      s: string; // symbol
      i: string; // interval
      f: number; // first trade id
      L: number; // last trade id
      o: string; // open
      c: string; // close
      h: string; // high
      l: string; // low
      v: string; // base asset volume
      n: number; // number of trades
      x: boolean; // is this kline closed?
      q: string; // quote asset volume
      V: string; // taker buy base asset volume
      Q: string; // taker buy quote asset volume
      B: string; // ignore
    };
  };
};

@Injectable()
export class MarketWsService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(MarketWsService.name);
  private ws?: WebSocket;
  private backoffMs = 1000; // começa com 1s
  private reconnectTimer?: NodeJS.Timeout;
  private inactivityTimer?: NodeJS.Timeout;
  private lastMsgAt = 0;

  private symbols: string[];
  private interval: string;
  private baseWs: string;

  constructor(
    private readonly cfg: ConfigService,
    private readonly events: EventEmitter2,
  ) {
    this.symbols = (this.cfg.get<string>('SYMBOLS') ?? 'btcusdt,ethusdt')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    this.interval = (this.cfg.get<string>('KLINE_INTERVAL') ?? '1m').trim();
    this.baseWs =
      this.cfg.get<string>('BINANCE_WS_BASE') ??
      'wss://stream.binance.com:9443';
  }

  onModuleInit() {
    if (!this.symbols.length) {
      this.log.warn(
        'Nenhum símbolo configurado em SYMBOLS. Abortando conexão WS.',
      );
      return;
    }
    this.connect();
  }

  onModuleDestroy() {
    this.cleanup('shutdown');
  }

  // --- conexão ---

  private connect() {
    const streams = this.symbols
      .map((s) => `${s}@kline_${this.interval}`)
      .join('/');
    const url = `${this.baseWs}/stream?streams=${streams}`;
    this.log.log(`Conectando WS: ${url}`);

    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      this.log.log(
        `WS aberto (${this.symbols.length} símbolos / ${this.interval}).`,
      );
      this.backoffMs = 1000; // reset backoff
      this.bumpInactivityWatch();
    });

    this.ws.on('message', (data) => this.onMessage(data));
    this.ws.on('error', (err) => {
      this.log.warn(`WS erro: ${String(err)}`);
      this.scheduleReconnect();
    });

    this.ws.on('close', (code, reason) => {
      this.log.warn(`WS fechado (${code}) ${reason?.toString() ?? ''}`.trim());
      this.scheduleReconnect();
    });
  }

  private onMessage(data: RawData) {
    this.lastMsgAt = Date.now();
    this.bumpInactivityWatch();

    try {
      const msg = JSON.parse(data.toString()) as KlineMsg;
      if (msg?.data?.e !== 'kline') return;

      const k = msg.data.k;
      const payload = {
        symbol: k.s,
        interval: k.i,
        isClosed: k.x,
        open: +k.o,
        high: +k.h,
        low: +k.l,
        close: +k.c,
        volume: +k.v,
        openTime: k.t,
        closeTime: k.T,
      };

      // Emite um evento por intervalo (ex.: "market.kline.1m")
      this.events.emit(`market.kline.${this.interval}`, payload);

      // Se quiser ouvir TUDO num só canal:
      this.events.emit('market.kline', payload);

      // Log opcional apenas quando fechar candle (reduz ruído)
      if (k.x) {
        this.log.debug(
          `[${payload.symbol}] ${this.interval} close=${payload.close} vol=${payload.volume}`,
        );
      }
    } catch (e) {
      this.log.warn(`Falha ao parsear mensagem WS: ${(e as Error).message}`);
    }
  }

  // --- resiliência ---

  private scheduleReconnect() {
    this.clearInactivityWatch();
    if (this.reconnectTimer) return; // já agendado
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.cleanup('reconnect');
      this.backoffMs = Math.min(this.backoffMs * 2, 30_000); // até 30s
      this.log.warn(`Reconectando WS (backoff atual: ${this.backoffMs}ms)…`);
      this.connect();
    }, this.backoffMs);
  }

  private bumpInactivityWatch() {
    this.clearInactivityWatch();
    // se ficar 30s sem mensagens, força reconectar
    this.inactivityTimer = setTimeout(() => {
      const delta = Date.now() - this.lastMsgAt;
      this.log.warn(`Sem mensagens há ${delta}ms. Reconectando…`);
      this.scheduleReconnect();
    }, 30_000);
  }

  private clearInactivityWatch() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = undefined;
    }
  }

  private cleanup(reason: 'reconnect' | 'shutdown') {
    this.clearInactivityWatch();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.close(1000, reason);
      } catch (error) {
        this.log.error(error);
      }
    }
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws = undefined;
    }
  }
}
