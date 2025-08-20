/* eslint-disable @typescript-eslint/await-thenable */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable } from '@nestjs/common';
import { CreateRuleDto, UpdateRuleDto } from './dto';
import { MarketWsService } from '../market-ingestor/market-ws.service';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class RulesService {
  constructor(
    private prisma: PrismaService,
    private market: MarketWsService,
  ) {}

  list(userId: string) {
    return this.prisma.rule.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, dto: CreateRuleDto) {
    const rule = await this.prisma.rule.create({
      data: {
        userId,
        symbol: dto.symbol.toLowerCase(),
        windowMin: dto.windowMin,
        thresholdPct: dto.thresholdPct,
        cooldownSec: dto.cooldownSec ?? 120,
        enabled: dto.enabled ?? true,
      },
    });
    await this.recalcSymbols();
    return rule;
  }

  async update(userId: string, id: string, dto: UpdateRuleDto) {
    const rule = await this.prisma.rule.update({ where: { id }, data: dto });
    // (opcional) garantir que pertence ao user; ou use where: { id, userId }
    await this.recalcSymbols();
    return rule;
  }

  async remove(userId: string, id: string) {
    await this.prisma.rule.delete({ where: { id } });
    await this.recalcSymbols();
    return { ok: true };
  }

  async recalcSymbols() {
    const active = await this.prisma.rule.findMany({
      where: { enabled: true },
      select: { symbol: true },
    });
    const symbols = [...new Set(active.map((r) => r.symbol))];
    this.market.setConfig({ symbols }); // mantém o intervalo atual
    return symbols;
  }
}
