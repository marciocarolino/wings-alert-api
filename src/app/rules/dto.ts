import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  Matches,
  Min,
} from 'class-validator';

export class CreateRuleDto {
  @ApiProperty({ example: 'btcusdt' })
  @Matches(/^[a-z0-9]{5,15}$/)
  symbol!: string;

  @ApiProperty({ example: 5 }) @IsInt() @Min(1) windowMin!: number;
  @ApiProperty({ example: 2 }) @IsNumber() thresholdPct!: number;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @IsInt()
  @Min(1)
  cooldownSec?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateRuleDto {
  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  windowMin?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsNumber()
  thresholdPct?: number;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @IsInt()
  @Min(1)
  cooldownSec?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
