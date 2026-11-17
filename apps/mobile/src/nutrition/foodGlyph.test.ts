import { foodGlyph } from './foodGlyph';

describe('foodGlyph', () => {
  it.each([
    ['Chicken Breast (cooked)', 'food-drumstick'],
    ['Salmon (cooked)', 'fish'],
    ['Egg White, Large', 'egg'],
    ['Peanut Butter', 'peanut'],
    ['Butter', 'cow'],
    ['Greek Yogurt, Plain Nonfat', 'cow'],
    ['Cottage Cheese, Low-Fat', 'cheese'],
    ['Whole Wheat Bread', 'bread-slice'],
    ['Oatmeal (cooked, plain)', 'rice'],
    ['Pasta (cooked)', 'pasta'],
    ['Strawberries', 'fruit-grapes'],
    ['Blueberries', 'fruit-grapes'],
    ['Orange', 'fruit-citrus'],
    ['Banana', 'food-apple'],
    ['Broccoli (cooked)', 'carrot'],
    ['Sweet Potato (baked)', 'carrot'],
    ['Black Beans (cooked)', 'seed'],
    ['Olive Oil', 'oil'],
    // USDA reference foods' names, as Search Food now finds them.
    ['Onions, raw', 'carrot'],
    ['Potatoes, flesh and skin, raw', 'carrot'],
    ['Tomatoes, red, ripe, raw', 'carrot'],
    ['Peaches, yellow, raw', 'food-apple'],
    ['Bananas, raw', 'food-apple'],
    ['Chicken, broilers or fryers, breast, meat only, cooked, roasted', 'food-drumstick'],
    ['Egg, whole, raw, fresh', 'egg'],
    ['Oats, raw', 'rice'],
    ['Assorted Green Peas', 'seed'],
  ])('gives %s the %s glyph', (name, glyph) => {
    expect(foodGlyph(name)).toBe(glyph);
  });

  it('falls back to a plain fork-and-knife for anything it does not recognise', () => {
    expect(foodGlyph('Mystery Casserole')).toBe('silverware-fork-knife');
    expect(foodGlyph('')).toBe('silverware-fork-knife');
  });
});
