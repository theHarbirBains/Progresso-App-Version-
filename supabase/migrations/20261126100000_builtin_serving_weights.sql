-- What a built-in food's serving weighs, in its serving wording: "1 large · 33 g".
--
-- The seeded built-ins whose serving isn't a weight ("1 large", "1 cup", "1 tbsp") said nothing
-- of what it weighs, so a figure someone doubted ("Egg White, Large", 17 cal) couldn't be checked,
-- and logging it by weight meant weighing it first. Each weight below is USDA FoodData Central's
-- own household measure (SR Legacy 2018-04) for the same food, and is used only where the
-- built-in's calories agree with USDA's for that weight to within 2%:
--
--   Egg, Large          1 large     50 g    USDA 171287  71.5 cal  (built-in 72)
--   Egg White, Large    1 large     33 g    USDA 172183  17.2 cal  (17)
--   Banana              1 medium   118 g    USDA 173944  105 cal   (105)
--   Apple               1 medium   182 g    USDA 171688  94.6 cal  (95)
--   Orange              1 medium   131 g    USDA 169097  61.6 cal  (62)
--   Strawberries        1 cup      152 g    USDA 167762  48.6 cal  (49)
--   Blueberries         1 cup      148 g    USDA 171711  84.4 cal  (84)
--   Grapes              1 cup      151 g    USDA 174683  104 cal   (104)
--   Mango               1 cup      165 g    USDA 169910  99 cal    (99)
--   Tomato              1 medium   123 g    USDA 170457  22.1 cal  (22)
--   Whole Milk          1 cup      244 g    USDA 171265  148.8 cal (149)
--   Skim Milk           1 cup      245 g    USDA 171269  83.3 cal  (83)
--   Butter              1 tbsp    14.2 g    USDA 173410  101.8 cal (102)
--   Peanut Butter       2 tbsp      32 g    USDA 172470  191 cal   (188)
--   Olive Oil           1 tbsp    13.5 g    USDA 171413  119.3 cal (119)
--   Whole Wheat Bread   1 slice     32 g    USDA 172688  80.6 cal  (81)
--
-- Left as they are, with no USDA weight that matches their figures closely enough: Avocado,
-- Bacon (cooked), White Bread and Bagel, Plain. Weighed servings (100 g, 1 oz) need nothing.
--
-- Only the wording changes: no serving size, unit or figure does, so nothing logged before reads
-- any differently (a log keeps its own snapshot), and nobody's own foods are touched -- a copy a
-- person keeps in their library stays exactly as it is. The wording is written so the log step
-- reads the weight from it (labelGrams) without naming pieces to count in: it adds grams and
-- ounces to the step, never a new tab. Only a built-in with no wording yet is changed, so this
-- never overwrites one.

update public.foods as food
set serving_label = weights.label
from (
  values
    ('Egg, Large', '1 large · 50 g'),
    ('Egg White, Large', '1 large · 33 g'),
    ('Banana', '1 medium · 118 g'),
    ('Apple', '1 medium · 182 g'),
    ('Orange', '1 medium · 131 g'),
    ('Strawberries', '1 cup · 152 g'),
    ('Blueberries', '1 cup · 148 g'),
    ('Grapes', '1 cup · 151 g'),
    ('Mango', '1 cup · 165 g'),
    ('Tomato', '1 medium · 123 g'),
    ('Whole Milk', '1 cup · 244 g'),
    ('Skim Milk', '1 cup · 245 g'),
    ('Butter', '1 tbsp · 14.2 g'),
    ('Peanut Butter', '2 tbsp · 32 g'),
    ('Olive Oil', '1 tbsp · 13.5 g'),
    ('Whole Wheat Bread', '1 slice · 32 g')
) as weights (name, label)
where food.created_by is null
  and food.provider is null
  and food.brand is null
  and food.name = weights.name
  and food.serving_label is null;
