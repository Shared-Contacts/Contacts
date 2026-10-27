-- ============================================================
-- Contacts database - Step 44: A short description for recipes
--
-- Adds one box to each recipe: a line or two about the dish, such
-- as "A popular Mexican-style dish, ideal for sharing". The app
-- shows it under the recipe's title. Recipes copied from a book or
-- read from a web page fill it in by themselves.
--
-- Nothing else changes, and nobody can see any more than before.
-- Both backup scripts already take every column of recipes, so they
-- need no change. Safe to run more than once.
--
-- Run this BEFORE putting the new index.html on GitHub: until it has
-- run, the new app cannot save a recipe.
-- ============================================================

alter table recipes add column if not exists about text;

alter table recipes drop constraint if exists recipes_about_length;
alter table recipes add constraint recipes_about_length
  check (about is null or length(about) <= 2000);

-- Check: one row, saying  about | text
select column_name, data_type
from information_schema.columns
where table_name = 'recipes' and column_name = 'about';
