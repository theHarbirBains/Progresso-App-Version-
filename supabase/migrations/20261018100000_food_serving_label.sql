-- A product's serving as its provider words it -- "3 cookies (34 g)", "1 package (85 g)" --
-- kept beside serving_size/serving_unit (which stay the serving's weight) so the log step
-- can offer the pieces it names ("Cookies") as well as servings and grams.
--
-- Empty when the provider was read and gave no wording; null when the row predates this
-- column (the API reads the provider again on that product's next scan and fills it in) or
-- for a food no provider supplied (seeded catalog foods, a user's own foods).
alter table public.foods
  add column serving_label text
    check (serving_label is null or char_length(serving_label) <= 80);
