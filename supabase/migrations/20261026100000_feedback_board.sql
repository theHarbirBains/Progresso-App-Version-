-- Feedback & Suggestions (Settings > Support & About) and the admins' inbox for it.
--
-- A person sends feedback through the API, which checks it, limits how often it's sent and
-- writes it; they read their own -- and its status history -- straight from here, and nobody
-- else's. A status, an internal note and every admin action are the API's alone to write
-- (support and full admins, through RolesGuard): no client can write any of them, and notes
-- and the admin log can't be read by any client at all.
--
-- Deleting an account deletes the person's feedback, its history and the notes on it (the
-- cascades below); the API clears their folder of screenshots first, as it does their photos.

-- ---------------------------------------------------------------------------------------------
-- What was sent
-- ---------------------------------------------------------------------------------------------

create table public.feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null check (category in ('bug', 'feature', 'usability', 'general')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null check (char_length(btrim(description)) between 1 and 4000),
  -- In the sender's own folder of feedback-screenshots ("<user_id>/<name>"), never anyone else's.
  screenshot_path text check (
    screenshot_path is null or split_part(screenshot_path, '/', 1) = user_id::text
  ),
  -- Captured by the app as it's sent, where it can tell.
  app_version text check (char_length(app_version) <= 32),
  build_number text check (char_length(build_number) <= 32),
  platform text check (platform in ('ios', 'android')),
  os_version text check (char_length(os_version) <= 32),
  status text not null default 'new'
    check (status in ('new', 'reviewing', 'planned', 'in_progress', 'completed', 'declined')),
  status_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index feedback_submissions_user_idx on public.feedback_submissions (user_id, created_at desc);
create index feedback_submissions_status_idx on public.feedback_submissions (status, created_at desc);

alter table public.feedback_submissions enable row level security;

create policy "feedback_submissions_select_own"
on public.feedback_submissions for select
to authenticated
using (user_id = auth.uid());

-- Sent, and moved on, only through the API (service role).
revoke all on public.feedback_submissions from anon;
revoke insert, update, delete on public.feedback_submissions from authenticated;

-- ---------------------------------------------------------------------------------------------
-- Its status history -- what the person sees as status updates
-- ---------------------------------------------------------------------------------------------

create table public.feedback_status_events (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.feedback_submissions (id) on delete cascade,
  status text not null
    check (status in ('new', 'reviewing', 'planned', 'in_progress', 'completed', 'declined')),
  created_at timestamptz not null default now()
);

create index feedback_status_events_submission_idx
  on public.feedback_status_events (submission_id, created_at);

alter table public.feedback_status_events enable row level security;

create policy "feedback_status_events_select_own"
on public.feedback_status_events for select
to authenticated
using (
  exists (
    select 1 from public.feedback_submissions s
    where s.id = submission_id and s.user_id = auth.uid()
  )
);

revoke all on public.feedback_status_events from anon;
revoke insert, update, delete on public.feedback_status_events from authenticated;

-- Every status a submission has had, kept as it happens: its first on sending, then each change
-- (when the change is made, too). Whoever moves it on, the history can't be skipped.
create function public.trg_feedback_status_changed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  return new;
end;
$$;

create trigger feedback_status_changed_at
before update of status on public.feedback_submissions
for each row execute function public.trg_feedback_status_changed_at();

create function public.trg_feedback_status_history()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.feedback_status_events (submission_id, status, created_at)
    values (new.id, new.status, new.status_changed_at);
  end if;
  return null;
end;
$$;

create trigger feedback_status_history
after insert or update of status on public.feedback_submissions
for each row execute function public.trg_feedback_status_history();

revoke execute on function public.trg_feedback_status_changed_at() from public, anon, authenticated;
revoke execute on function public.trg_feedback_status_history() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Admins' internal notes -- never shown to the person who sent it
-- ---------------------------------------------------------------------------------------------

create table public.feedback_notes (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.feedback_submissions (id) on delete cascade,
  -- An admin who later deletes their account leaves their notes, unsigned.
  author_id uuid references auth.users (id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index feedback_notes_submission_idx on public.feedback_notes (submission_id, created_at);

alter table public.feedback_notes enable row level security;

-- No client policies at all: read and written by the API for admins only.
revoke all on public.feedback_notes from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Every admin action, kept (CLAUDE.md: all administrative actions must be auditable)
-- ---------------------------------------------------------------------------------------------

create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  -- No foreign key: the record outlives the admin's account, as trainer_actions does.
  admin_id uuid not null,
  action text not null,
  target_table text,
  target_id uuid,
  -- What changed ({"from": "new", "to": "planned"}); never a note's or a submission's text.
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index admin_actions_admin_idx on public.admin_actions (admin_id, created_at desc);
create index admin_actions_target_idx on public.admin_actions (target_table, target_id, created_at desc);

create function public.trg_admin_actions_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'admin_actions is append-only';
end;
$$;

create trigger admin_actions_append_only
before update or delete on public.admin_actions
for each row execute function public.trg_admin_actions_append_only();

revoke execute on function public.trg_admin_actions_append_only() from public, anon, authenticated;

alter table public.admin_actions enable row level security;

-- No client policies at all: written by the API, read in the Supabase dashboard.
revoke all on public.admin_actions from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Screenshots: private, in each person's own folder
-- ---------------------------------------------------------------------------------------------

-- Private (unlike the photo buckets): read through signed links only -- the sender's own, or the
-- API's short-lived one for an admin. 5 MB, JPEG or PNG.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback-screenshots', 'feedback-screenshots', false, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "feedback_screenshot_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'feedback-screenshots' and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "feedback_screenshot_select_own"
on storage.objects for select
to authenticated
using (
  bucket_id = 'feedback-screenshots' and (storage.foldername(name))[1] = auth.uid()::text
);

-- Only so the app can take back a screenshot whose feedback didn't send: one a submission points
-- at stays (there's no update policy either, and a sent submission can't be changed).
create policy "feedback_screenshot_delete_unsent_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'feedback-screenshots'
  and (storage.foldername(name))[1] = auth.uid()::text
  and not exists (
    select 1 from public.feedback_submissions s where s.screenshot_path = storage.objects.name
  )
);
