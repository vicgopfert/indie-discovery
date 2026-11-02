import { Module } from '@nestjs/common';
import { RecommendationModule } from '../recommendation/recommendation.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [RecommendationModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
