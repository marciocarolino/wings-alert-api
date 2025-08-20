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
    E: number;
    s: string;
    k: {
      t: number;
      T: number;
      s: string;
      i: string;
      f: number;
      L: number;
      o: string;
      c: string;
      h: string;
      l: string;
      v: string;
      n: number;
      x: boolean;
      q: string;
      V: string;
      Q: string;
      B: string;
    };
  };
};

@Injectable()
export class MarketWsService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(MarketWsService.name);
  private ws?: WebSocket;
  private backoffMs = 1000;
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

  // ---------- lifecycle ----------
  onModuleInit() {
    if (!this.symbols.length) {
      this.log.warn(
        'Nenhum símbolo configurado. Ajuste em runtime via /market/symbols.',
      );
      return;
    }
    this.connect();
  }
  onModuleDestroy() {
    this.cleanup('shutdown');
  }

  // ---------- getters/setters públicos ----------
  getSymbols() {
    return [...this.symbols];
  }
  getInterval() {
    return this.interval;
  }

  /** Substitui completamente a lista de símbolos e (opcional) o intervalo. */
  setConfig({ symbols, interval }: { symbols?: string[]; interval?: string }) {
    const nextSymbols = symbols ? this.normalize(symbols) : this.symbols;
    const nextInterval = interval ? interval.trim() : this.interval;

    const changed =
      nextInterval !== this.interval ||
      nextSymbols.length !== this.symbols.length ||
      nextSymbols.some((s, i) => s !== this.symbols[i]);

    this.symbols = nextSymbols;
    this.interval = nextInterval;

    if (changed) this.reconnectNow('reconfigure');
    return { symbols: this.getSymbols(), interval: this.interval };
  }

  addSymbols(toAdd: string[]) {
    const add = this.normalize(toAdd);
    const set = new Set(this.symbols.concat(add));
    const merged = [...set];
    return this.setConfig({ symbols: merged });
  }

  removeSymbol(symbol: string) {
    const s = symbol.trim().toLowerCase();
    const filtered = this.symbols.filter((x) => x !== s);
    return this.setConfig({ symbols: filtered });
  }

  // ---------- conexão WS ----------
  private connect() {
    if (!this.symbols.length) {
      this.log.warn('Sem símbolos para assinar — WS não será aberto.');
      return;
    }
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
      this.backoffMs = 1000;
      this.bumpInactivityWatch();
    });

    this.ws.on('message', (data: RawData) => this.onMessage(data));
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
      this.events.emit(`market.kline.${this.interval}`, payload);
      this.events.emit('market.kline', payload);
      if (k.x)
        this.log.debug(
          `[${payload.symbol}] ${this.interval} close=${payload.close} vol=${payload.volume}`,
        );
    } catch (e) {
      this.log.warn(`Falha ao parsear mensagem WS: ${(e as Error).message}`);
    }
  }

  // ---------- resiliência ----------
  private scheduleReconnect() {
    this.clearInactivityWatch();
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.cleanup('reconnect');
      this.backoffMs = Math.min(this.backoffMs * 2, 30_000);
      this.log.warn(`Reconectando WS (backoff atual: ${this.backoffMs}ms)…`);
      this.connect();
    }, this.backoffMs);
  }

  private reconnectNow(reason: 'reconfigure') {
    this.clearInactivityWatch();
    this.cleanup(reason);
    this.backoffMs = 1000; // sem penalidade na reconfiguração
    this.connect();
  }

  private bumpInactivityWatch() {
    this.clearInactivityWatch();
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

  private cleanup(reason: 'reconnect' | 'shutdown' | 'reconfigure') {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.close(1000, reason);
      } catch (error) {
        this.log.error(`Error ${error}`);
      }
    }
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws = undefined;
    }
  }

  private normalize(list: string[]) {
    return [
      ...new Set(
        list
          .map((s) => s.trim().toLowerCase())
          .filter((s) => /^[a-z0-9]{5,15}$/.test(s)), // formato simples, ex: btcusdt
      ),
    ].sort();
  }
}
