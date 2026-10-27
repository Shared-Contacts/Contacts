-- ============================================================
-- Contacts database - Step 45: Which app a URL Link opens in
--
-- Adds one choice to each link in URL Links: Open with Chrome, the
-- YouTube app, the Barclays app, or blank for the phone to decide
-- as before. It is chosen once, when the link is added.
--
-- Nothing else changes, and nobody can see any more than before.
-- Both backup scripts already take every column of url_links, so
-- they need no change. Safe to run more than once.
--
-- Run this BEFORE putting the new index.html on GitHub. Until it has
-- run, links still save, but without their Open with choice.
-- ============================================================

alter table url_links add column if not exists open_with text;

alter table url_links drop constraint if exists url_links_open_with_length;
alter table url_links add constraint url_links_open_with_length
  check (open_with is null or length(open_with) <= 40);

-- Check: one row, saying  open_with | text
select column_name, data_type
from information_schema.columns
where table_name = 'url_links' and column_name = 'open_with';
