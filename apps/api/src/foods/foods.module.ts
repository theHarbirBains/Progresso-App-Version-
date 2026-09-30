import { Module } from '@nestjs/common';
import { FOOD_PROVIDER } from './food-provider.interface';
import { FoodsController } from './foods.controller';
import { FoodsService } from './foods.service';
import { AnthropicNutritionProvider } from './providers/anthropic-nutrition.provider';
import { OpenFoodFactsProvider } from './providers/open-food-facts.provider';

@Module({
  controllers: [FoodsController],
  providers: [
    FoodsService,
    { provide: FOOD_PROVIDER, useClass: OpenFoodFactsProvider },
    AnthropicNutritionProvider,
  ],
})
export class FoodsModule {}
