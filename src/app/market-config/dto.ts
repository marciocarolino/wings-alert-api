import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  ArrayNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class SetSymbolsDto {
  @ApiProperty({ type: [String], example: ['btcusdt', 'ethusdt', 'solusdt'] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @Matches(/^[a-z0-9]{5,15}$/, { each: true, message: 'símbolo inválido' })
  symbols!: string[];

  @ApiPropertyOptional({
    example: '1m',
    description: 'Intervalo global (ex.: 1m, 5m, 15m, 1h...)',
  })
  @IsOptional()
  @IsString()
  interval?: string;
}

export class AddSymbolsDto {
  @ApiProperty({ type: [String], example: ['adausdt'] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @Matches(/^[a-z0-9]{5,15}$/, { each: true })
  symbols!: string[];
}
