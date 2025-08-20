import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AddSymbolsDto, SetSymbolsDto } from './dto';
import { MarketConfigService } from './market-config.service';

@ApiTags('market')
@Controller('market')
export class MarketConfigController {
  constructor(private readonly svc: MarketConfigService) {}

  @ApiOperation({ summary: 'Status atual do ingestor (símbolos e intervalo)' })
  @ApiOkResponse({
    schema: {
      properties: {
        symbols: { type: 'array', items: { type: 'string' } },
        interval: { type: 'string' },
      },
    },
  })
  @Get('symbols')
  getStatus() {
    return this.svc.status();
  }

  @ApiOperation({
    summary: 'Substituir lista de símbolos (e opcionalmente o intervalo)',
  })
  @Put('symbols')
  setSymbols(@Body() dto: SetSymbolsDto) {
    return this.svc.setSymbols(dto.symbols, dto.interval);
  }

  @ApiOperation({ summary: 'Adicionar símbolos à lista atual' })
  @Post('symbols')
  addSymbols(@Body() dto: AddSymbolsDto) {
    return this.svc.addSymbols(dto.symbols);
  }

  @ApiOperation({ summary: 'Remover um símbolo da lista' })
  @Delete('symbols/:symbol')
  remove(@Param('symbol') symbol: string) {
    return this.svc.removeSymbol(symbol);
  }
}
