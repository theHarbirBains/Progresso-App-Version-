-- Initial default food catalog: common whole foods across the usual
-- logging categories (proteins, grains/starches, fruit, vegetables, dairy,
-- fats/nuts, legumes). Nutritional values are standard reference figures
-- for the named preparation (USDA-basis, per the stated serving) -- not
-- fabricated placeholders. Every serving amount/unit is realistic for how
-- someone would actually log that food (100g for bulk cooked/raw items,
-- natural units like "1 medium"/"1 large"/"1 cup"/"1 tbsp" otherwise),
-- matching the "serving must be explicit" requirement.
--
-- on conflict targets foods_builtin_name_brand_unique (see previous
-- migration) so re-running this insert (e.g. a misapplied/rerun migration)
-- never creates duplicate built-in rows.
insert into public.foods (name, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g) values
  -- proteins
  ('Chicken Breast (cooked)', 100, 'g', 165, 31, 0, 3.6),
  ('Chicken Thigh (cooked)', 100, 'g', 209, 26, 0, 10.9),
  ('Ground Beef 85% Lean (cooked)', 100, 'g', 250, 26, 0, 15),
  ('Salmon (cooked)', 100, 'g', 208, 20, 0, 13),
  ('Tuna, Canned in Water', 100, 'g', 116, 26, 0, 0.8),
  ('Shrimp (cooked)', 100, 'g', 99, 24, 0.2, 0.3),
  ('Egg, Large', 1, 'large', 72, 6.3, 0.4, 4.8),
  ('Egg White, Large', 1, 'large', 17, 3.6, 0.2, 0.1),
  ('Tofu, Firm', 100, 'g', 144, 15.8, 2.8, 8.7),
  ('Turkey Breast (cooked)', 100, 'g', 135, 30, 0, 1),
  ('Pork Chop (cooked)', 100, 'g', 231, 26, 0, 14),
  ('Bacon (cooked)', 2, 'slices', 86, 6, 0.2, 6.6),
  -- grains / starches
  ('White Rice (cooked)', 100, 'g', 130, 2.7, 28, 0.3),
  ('Brown Rice (cooked)', 100, 'g', 123, 2.6, 25.6, 1),
  ('Quinoa (cooked)', 100, 'g', 120, 4.4, 21.3, 1.9),
  ('Oatmeal (cooked, plain)', 100, 'g', 71, 2.5, 12, 1.5),
  ('Whole Wheat Bread', 1, 'slice', 81, 4, 13.8, 1.1),
  ('White Bread', 1, 'slice', 75, 2.6, 13.8, 1),
  ('Pasta (cooked)', 100, 'g', 131, 5, 25, 1.1),
  ('Sweet Potato (baked)', 100, 'g', 90, 2, 21, 0.1),
  ('Potato (baked)', 100, 'g', 93, 2.5, 21.2, 0.1),
  ('Bagel, Plain', 1, 'medium', 245, 9.4, 47.9, 1.5),
  -- fruit
  ('Banana', 1, 'medium', 105, 1.3, 27, 0.4),
  ('Apple', 1, 'medium', 95, 0.5, 25, 0.3),
  ('Orange', 1, 'medium', 62, 1.2, 15.4, 0.2),
  ('Strawberries', 1, 'cup', 49, 1, 11.7, 0.5),
  ('Blueberries', 1, 'cup', 84, 1.1, 21.4, 0.5),
  ('Grapes', 1, 'cup', 104, 1.1, 27.3, 0.2),
  ('Avocado', 1, 'medium', 240, 3, 12.8, 22),
  ('Mango', 1, 'cup', 99, 1.4, 24.7, 0.6),
  -- vegetables
  ('Broccoli (cooked)', 100, 'g', 35, 2.4, 7.2, 0.4),
  ('Spinach (raw)', 100, 'g', 23, 2.9, 3.6, 0.4),
  ('Carrots (raw)', 100, 'g', 41, 0.9, 9.6, 0.2),
  ('Green Beans (cooked)', 100, 'g', 35, 1.8, 8, 0.1),
  ('Bell Pepper (raw)', 100, 'g', 31, 1, 6, 0.3),
  ('Tomato', 1, 'medium', 22, 1.1, 4.8, 0.2),
  ('Cucumber', 100, 'g', 15, 0.7, 3.6, 0.1),
  -- dairy
  ('Whole Milk', 1, 'cup', 149, 7.7, 11.7, 8),
  ('Skim Milk', 1, 'cup', 83, 8.3, 12.2, 0.2),
  ('Greek Yogurt, Plain Nonfat', 100, 'g', 59, 10.2, 3.6, 0.4),
  ('Cheddar Cheese', 1, 'oz', 113, 7, 0.4, 9.3),
  ('Cottage Cheese, Low-Fat', 100, 'g', 72, 12.4, 2.7, 1),
  ('Butter', 1, 'tbsp', 102, 0.1, 0, 11.5),
  -- fats / nuts / seeds
  ('Almonds', 1, 'oz', 164, 6, 6.1, 14.2),
  ('Peanut Butter', 2, 'tbsp', 188, 8, 6.9, 16),
  ('Olive Oil', 1, 'tbsp', 119, 0, 0, 13.5),
  ('Walnuts', 1, 'oz', 185, 4.3, 3.9, 18.5),
  ('Chia Seeds', 1, 'oz', 137, 4.4, 12, 8.6),
  -- legumes
  ('Black Beans (cooked)', 100, 'g', 132, 8.9, 23.7, 0.5),
  ('Chickpeas (cooked)', 100, 'g', 164, 8.9, 27.4, 2.6),
  ('Lentils (cooked)', 100, 'g', 116, 9, 20.1, 0.4)
on conflict (lower(name), lower(coalesce(brand, ''))) where created_by is null do nothing;
