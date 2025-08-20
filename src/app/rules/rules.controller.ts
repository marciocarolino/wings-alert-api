/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RulesService } from './rules.service';
import { CreateRuleDto, UpdateRuleDto } from './dto';
import { JwtAuthGuard } from 'src/auth/jwt.guard';

@ApiTags('rules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rules')
export class RulesController {
  constructor(private svc: RulesService) {}

  @ApiOperation({ summary: 'Listar regras do usuário' })
  @Get()
  list(@Req() req: any) {
    return this.svc.list(req.user.userId);
  }

  @ApiOperation({ summary: 'Criar regra' })
  @Post()
  create(@Req() req: any, @Body() dto: CreateRuleDto) {
    return this.svc.create(req.user.userId, dto);
  }

  @ApiOperation({ summary: 'Atualizar regra' })
  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateRuleDto) {
    return this.svc.update(req.user.userId, id, dto);
  }

  @ApiOperation({ summary: 'Remover regra' })
  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.svc.remove(req.user.userId, id);
  }
}
