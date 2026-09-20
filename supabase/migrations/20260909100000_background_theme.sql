-- Per-user Background Theme selection (Appearance settings). Nullable: a
-- row with no value means "never customized" -- the backend/app fall back
-- to the 'obsidian' default rather than this column ever needing a stored
-- default. Dark variants only for now; light themes are a separate,
-- follow-up piece of work (see DESIGN.md's current dark-mode-only rule).
alter table public.users
  add column background_theme text;

alter table public.users add constraint users_background_theme_valid
  check (
    background_theme is null or background_theme in (
      'obsidian', 'midnight', 'forest', 'plum', 'starlight',
      'aurora', 'topographic', 'carbon', 'particles'
    )
  );
