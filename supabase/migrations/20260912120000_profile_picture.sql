-- Profile pictures: stored in Supabase Storage, never as a binary blob in
-- Postgres -- this column only ever holds a reference (the bucket's public
-- URL, with a cache-busting query param the client appends on each
-- upload), the same "reference, not the blob" principle every other
-- snapshot/reference column in this schema already follows.
alter table public.users add column avatar_url text;

-- Public bucket: a profile picture is the one piece of user data this app
-- already treats as fine to be viewable by anyone who has its URL (the
-- same choice virtually every app makes for avatars) -- what actually
-- needs isolating is WRITE access, which the per-user-folder policies
-- below enforce via the "{auth.uid()}/..." path convention (Supabase's own
-- documented pattern for user-scoped storage). Keeping reads public also
-- means displaying an avatar anywhere in the app never needs a signed,
-- expiring URL refreshed on every screen.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatar_insert_own"
on storage.objects for insert
to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatar_update_own"
on storage.objects for update
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatar_delete_own"
on storage.objects for delete
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatar_select_public"
on storage.objects for select
to public
using (bucket_id = 'avatars');
