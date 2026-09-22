-- Photos for a user's own custom foods (foods.image_url already exists -- see
-- 20260918100000_food_log_meals_and_images.sql -- and only ever held an Open
-- Food Facts URL until now).
--
-- Same bucket pattern as avatars/equipment-photos: files live under
-- "{auth.uid()}/..." and only that user can write there. Unlike those two,
-- listing is NOT public: the select policy is the owner's own folder only, so
-- nobody can enumerate other users' food photos through the storage API. The
-- bucket itself is public so the app can render a photo from its URL without
-- signing it on every screen; the file name is random and unguessable, and the
-- only place the URL is stored is on the owner's private food row (RLS:
-- foods_select shows a custom food to its creator only).
insert into storage.buckets (id, name, public)
values ('food-photos', 'food-photos', true)
on conflict (id) do nothing;

create policy "food_photo_insert_own"
on storage.objects for insert
to authenticated
with check (bucket_id = 'food-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "food_photo_update_own"
on storage.objects for update
to authenticated
using (bucket_id = 'food-photos' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'food-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "food_photo_delete_own"
on storage.objects for delete
to authenticated
using (bucket_id = 'food-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "food_photo_select_own"
on storage.objects for select
to authenticated
using (bucket_id = 'food-photos' and (storage.foldername(name))[1] = auth.uid()::text);
