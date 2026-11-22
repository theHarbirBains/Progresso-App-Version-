-- Progresso's own built-in foods get their micronutrients, from USDA FoodData Central.
--
-- The 51 built-ins seeded in 20260912100001 had no micronutrients, and Search Food ranks them first
-- for the plainest foods ("chicken breast", "banana", "rice"), so a search for one said it had no
-- vitamin or mineral data. Their figures were USDA's, per their serving: each is matched here to the
-- SR Legacy food (2018-04, imported as usda_food_reference) its figures are, and given that food's
-- micronutrients for its serving's weight -- read from usda_food_reference, never typed in.
--
-- A built-in is matched only where USDA's figures for that weight agree with its own: calories to
-- within 2%, protein and fat to within 5% (or 0.5 g), checked against the SR Legacy files when this
-- was written and again here against the reference rows. A non-weighed serving's weight is USDA's
-- own household measure for that food (20261126100000_builtin_serving_weights.sql). Left without, as
-- no USDA food matches their figures closely enough: Chicken Thigh, Salmon, Tofu, Turkey Breast,
-- Bacon, White Bread, Bagel, Avocado, Bell Pepper, Cheddar Cheese and Peanut Butter.
--
-- A person's own copy of a built-in (kept in their library as they logged it, `keepInLibrary`) gets
-- the same, where it's still exactly the built-in -- same name, serving and figures, never changed.
-- Logs are never filled in: a log keeps what was known when it was logged.
--
-- Then fill_usda_micronutrients() runs again, for any USDA food cached between the import and the
-- server that caches micronutrients going live (cached once, a food isn't cached again).

with matches (name, fdc_id, grams) as (
  values
    -- Chicken, broilers or fryers, breast, meat only, cooked, roasted
    ('Chicken Breast (cooked)', 171477, 100),
    -- Beef, ground, 85% lean meat / 15% fat, patty, cooked, broiled
    ('Ground Beef 85% Lean (cooked)', 174032, 100),
    -- Fish, tuna, light, canned in water, without salt, drained solids
    ('Tuna, Canned in Water', 171986, 100),
    -- Crustaceans, shrimp, cooked
    ('Shrimp (cooked)', 175180, 100),
    -- Egg, whole, raw, fresh
    ('Egg, Large', 171287, 50),
    -- Egg, white, raw, fresh
    ('Egg White, Large', 172183, 33),
    -- Pork, fresh, loin, center loin (chops), boneless, separable lean and fat, cooked, pan-broiled
    ('Pork Chop (cooked)', 168298, 100),
    -- Rice, white, long-grain, regular, enriched, cooked
    ('White Rice (cooked)', 168878, 100),
    -- Rice, brown, long-grain, cooked (Includes foods for USDA's Food Distribution Program)
    ('Brown Rice (cooked)', 169704, 100),
    -- Quinoa, cooked
    ('Quinoa (cooked)', 168917, 100),
    -- Cereals, oats, regular and quick and instant, unenriched, cooked with water (includes boiling and microwaving), with salt
    ('Oatmeal (cooked, plain)', 171675, 100),
    -- Bread, whole-wheat, commercially prepared
    ('Whole Wheat Bread', 172688, 32),
    -- Pasta, fresh-refrigerated, plain, cooked
    ('Pasta (cooked)', 169728, 100),
    -- Sweet potato, cooked, baked in skin, flesh, without salt
    ('Sweet Potato (baked)', 168483, 100),
    -- Potatoes, baked, flesh and skin, without salt
    ('Potato (baked)', 170093, 100),
    -- Bananas, raw
    ('Banana', 173944, 118),
    -- Apples, raw, with skin (Includes foods for USDA's Food Distribution Program)
    ('Apple', 171688, 182),
    -- Oranges, raw, all commercial varieties
    ('Orange', 169097, 131),
    -- Strawberries, raw
    ('Strawberries', 167762, 152),
    -- Blueberries, raw
    ('Blueberries', 171711, 148),
    -- Grapes, red or green (European type, such as Thompson seedless), raw
    ('Grapes', 174683, 151),
    -- Mangos, raw
    ('Mango', 169910, 165),
    -- Broccoli, cooked, boiled, drained, without salt
    ('Broccoli (cooked)', 169967, 100),
    -- Spinach, raw
    ('Spinach (raw)', 168462, 100),
    -- Carrots, raw
    ('Carrots (raw)', 170393, 100),
    -- Beans, snap, green, cooked, boiled, drained, without salt
    ('Green Beans (cooked)', 169141, 100),
    -- Tomatoes, red, ripe, raw, year round average
    ('Tomato', 170457, 123),
    -- Cucumber, with peel, raw
    ('Cucumber', 168409, 100),
    -- Milk, whole, 3.25% milkfat, with added vitamin D
    ('Whole Milk', 171265, 244),
    -- Milk, nonfat, fluid, with added vitamin A and vitamin D (fat free or skim)
    ('Skim Milk', 171269, 245),
    -- Yogurt, Greek, plain, nonfat (Includes foods for USDA's Food Distribution Program)
    ('Greek Yogurt, Plain Nonfat', 170894, 100),
    -- Cheese, cottage, lowfat, 1% milkfat
    ('Cottage Cheese, Low-Fat', 173417, 100),
    -- Butter, salted
    ('Butter', 173410, 14.2),
    -- Nuts, almonds
    ('Almonds', 170567, 28.35),
    -- Oil, olive, salad or cooking
    ('Olive Oil', 171413, 13.5),
    -- Nuts, walnuts, english
    ('Walnuts', 170187, 28.35),
    -- Seeds, chia seeds, dried
    ('Chia Seeds', 170554, 28.35),
    -- Beans, black, mature seeds, cooked, boiled, without salt
    ('Black Beans (cooked)', 173735, 100),
    -- Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, without salt
    ('Chickpeas (cooked)', 173757, 100),
    -- Lentils, mature seeds, cooked, boiled, without salt
    ('Lentils (cooked)', 172421, 100)
),
filled as (
  select
    food.id,
    (
      select jsonb_object_agg(e.key, round((e.value)::numeric * m.grams / 100, 4))
      from jsonb_each(r.micronutrients_per_100g) as e
    ) as micronutrients
  from public.foods as food
  join matches as m on m.name = food.name
  join public.usda_food_reference as r on r.fdc_id = m.fdc_id
  where food.created_by is null
    and food.provider is null
    and food.brand is null
    and food.micronutrients is null
    and r.micronutrients_per_100g is not null
    and r.micronutrients_per_100g <> '{}'::jsonb
    and abs(food.calories - r.calories_per_100g * m.grams / 100) <= greatest(0.02 * food.calories, 0.5)
    and abs(food.protein_g - r.protein_g_per_100g * m.grams / 100) <= greatest(0.05 * food.protein_g, 0.5)
    and abs(food.fat_g - r.fat_g_per_100g * m.grams / 100) <= greatest(0.05 * food.fat_g, 0.5)
)
update public.foods as food
set micronutrients = filled.micronutrients
from filled
where food.id = filled.id;

-- People's own copies of those built-ins, unchanged since they were kept.
update public.foods as copy
set micronutrients = builtin.micronutrients
from public.foods as builtin
where builtin.created_by is null
  and builtin.provider is null
  and builtin.brand is null
  and builtin.micronutrients is not null
  and copy.created_by is not null
  and copy.micronutrients is null
  and copy.recipe_servings is null
  and copy.brand is null
  and copy.name = builtin.name
  and copy.serving_size = builtin.serving_size
  and copy.serving_unit = builtin.serving_unit
  and copy.calories = builtin.calories
  and copy.protein_g = builtin.protein_g
  and copy.carbs_g = builtin.carbs_g
  and copy.fat_g = builtin.fat_g;

select public.fill_usda_micronutrients();
