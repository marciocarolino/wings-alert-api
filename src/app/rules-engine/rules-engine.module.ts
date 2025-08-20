import { Module } from '@nestjs/common';
import { RulesEngineService } from './rules-engine.service';

@Module({
  providers: [RulesEngineService],
})
export class RulesEngineModule {}
