-- Meal assignment (Breakfast/Lunch/Dinner/Snack) for food_logs, and a
-- product image column on foods -- both genuinely new: no meal-type
-- concept and no image column existed anywhere before this migration (see
-- the Food -> Serving/Quantity -> Log Food -> Dashboard workflow).
--
-- meal_type is nullable, not required: every log the app writes from here
-- on always supplies one (the logging UI requires a selection, defaulting
-- to the current time of day), but making it NOT NULL would break any
-- food_logs row already written before this migration. Same "add
-- optional, never backfill-required" precedent as nutrition_goals' own
-- individually-nullable columns.
alter table public.food_logs
  add column meal_type text;

alter table public.food_logs
  add constraint food_logs_meal_type_check
  check (meal_type is null or meal_type in ('breakfast', 'lunch', 'dinner', 'snack'));

-- image_url: Open Food Facts' product/search responses support an
-- image_front_url field (among others) that the existing integration
-- never requested -- see apps/api/src/foods/providers/open-food-facts.provider.ts.
-- Null for every generic/seeded food and every user-created custom food,
-- which simply have no photo; never fabricated.
alter table public.foods
  add column image_url text;
