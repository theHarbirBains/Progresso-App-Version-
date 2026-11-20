-- Framing a montage photo (explicitly requested): its owner moves and zooms a photo within its
-- panel. Kept as where the photo sits, never as a new file: frame_x and frame_y are the point of
-- the photo at the middle of its panel (0-1, across and down), frame_zoom how far it's zoomed in
-- past just filling the panel (1-4). All three or none -- none is the automatic framing (centred,
-- a tall photo toward its top). Photos only. The owner changes them straight from the app under
-- the montage's own-row policy; everything else about a row still never changes once added.

alter table public.profile_montage_items
  add column frame_x numeric(5, 4) check (frame_x between 0 and 1),
  add column frame_y numeric(5, 4) check (frame_y between 0 and 1),
  add column frame_zoom numeric(4, 2) check (frame_zoom between 1 and 4),
  add constraint profile_montage_items_frame_whole
    check ((frame_x is null) = (frame_y is null) and (frame_y is null) = (frame_zoom is null)),
  add constraint profile_montage_items_frame_photo check (kind = 'photo' or frame_x is null);

grant update (frame_x, frame_y, frame_zoom) on public.profile_montage_items to authenticated;
