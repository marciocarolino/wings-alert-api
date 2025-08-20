import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

type KlinePayload = {
  symbol: string;
  interval: string;
  isClosed: boolean;
  close: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  openTime: number;
};

type Candle = { closeTime: number; close: number };

@Injectable()
export class RulesEngineService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(RulesEngineService.name);

  private readonly interval: string;
  private readonly thresholdPct: number;
  private readonly windowMin: number;
  private readonly cooldownMs: number;

  private unsub?: () => void;

  // buffers por símbolo (somente candles FECHADOS)
  private buffers = new Map<string, Candle[]>();
  // último alerta por símbolo (p/ cooldown)
  private lastAlertAt = new Map<string, number>();

  constructor(
    private readonly cfg: ConfigService,
    private readonly events: EventEmitter2,
  ) {
    this.interval = this.cfg.get<string>('KLINE_INTERVAL') ?? '1m';
    this.thresholdPct = Number(
      this.cfg.get<string>('RULE_THRESHOLD_PCT') ?? '2',
    );
    this.windowMin = Number(this.cfg.get<string>('RULE_WINDOW_MIN') ?? '5');
    this.cooldownMs =
      Number(this.cfg.get<string>('RULE_COOLDOWN_SEC') ?? '120') * 1000;

    if (this.thresholdPct <= 0)
      this.log.warn('RULE_THRESHOLD_PCT <= 0 (usando 2%)');
  }

  onModuleInit() {
    const channel = `market.kline.${this.interval}`;
    const handler = (p: KlinePayload) => this.onKline(p);
    // Programático p/ não “fixar” o intervalo em tempo de compilação
    this.events.on(channel, handler);
    this.unsub = () => this.events.off(channel, handler);

    this.log.log(
      `Rules engine ouvindo ${channel} | threshold=${this.thresholdPct}% window=${this.windowMin}min cooldown=${this.cooldownMs / 1000}s`,
    );
  }

  onModuleDestroy() {
    if (this.unsub) this.unsub();
  }

  // --- handlers ---

  private onKline(p: KlinePayload) {
    if (!p.isClosed) return; // só processa no fechamento do candle

    const buf = this.getBuffer(p.symbol);
    buf.push({ closeTime: p.closeTime, close: p.close });

    // mantém um histórico razoável (ex.: 6h para 1m = 360 entradas)
    const max = Math.max(60 * 6, this.stepsRequired() + 10);
    if (buf.length > max) buf.splice(0, buf.length - max);

    const steps = this.stepsRequired();
    const prevIdx = buf.length - 1 - steps;
    if (prevIdx < 0) return;

    const prev = buf[prevIdx].close;
    if (prev === 0) return;

    const pct = ((p.close - prev) / prev) * 100;

    if (Math.abs(pct) >= this.thresholdPct) {
      // cooldown por símbolo
      const last = this.lastAlertAt.get(p.symbol) ?? 0;
      const now = Date.now();
      if (now - last < this.cooldownMs) {
        this.log.verbose(
          `[${p.symbol}] Δ${this.windowMin}m=${pct.toFixed(2)}% (em cooldown)`,
        );
        return;
      }
      this.lastAlertAt.set(p.symbol, now);

      // “ALERTA” — por enquanto só loga; próximo passo enviaremos pro Telegram
      const dir = pct > 0 ? '↑ ALTA' : '↓ QUEDA';
      this.log.warn(
        `ALERTA ${dir} — ${p.symbol} | Δ${this.windowMin}m=${pct.toFixed(2)}% | close=${p.close} | ${new Date(p.closeTime).toISOString()}`,
      );
    } else {
      this.log.debug(
        `[${p.symbol}] Δ${this.windowMin}m=${pct.toFixed(2)}% (sem alerta)`,
      );
    }
  }

  // --- utilitários ---

  private getBuffer(symbol: string) {
    let b = this.buffers.get(symbol);
    if (!b) {
      b = [];
      this.buffers.set(symbol, b);
    }
    return b;
  }

  private stepsRequired(): number {
    // converte “1m/3m/5m/15m/1h…” em minutos
    const intervalMs = this.intervalToMs(this.interval);
    const windowMs = this.windowMin * 60_000;
    return Math.max(1, Math.round(windowMs / intervalMs));
  }

  private intervalToMs(i: string): number {
    const m = i.match(/^(\d+)([mhd])$/i);
    if (!m) return 60_000; // default 1m
    const n = Number(m[1]);
    const unit = m[2].toLowerCase();
    if (unit === 'm') return n * 60_000;
    if (unit === 'h') return n * 60 * 60_000;
    if (unit === 'd') return n * 24 * 60 * 60_000;
    return 60_000;
  }
}
