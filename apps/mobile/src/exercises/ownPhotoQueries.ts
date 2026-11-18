import { uploadEquipmentPhoto } from '../lib/equipmentPhotoUpload';
import { supabase } from '../lib/supabase';
import { forgetOwnPhotos, setOwnPhotoSource } from './ownPhotos';

// The person's own machine photos for built-ins, read and written straight to Supabase under its
// own-row policy (exercise_user_photos), the photo itself in their own equipment-photos folder like
// a custom exercise's. Plugged into ownPhotos.ts as this module loads (exerciseGuide.ts loads it).

async function signedInUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error('Sign in to add a photo.');
  return userId;
}

setOwnPhotoSource({
  async read() {
    const { data, error } = await supabase
      .from('exercise_user_photos')
      .select('exercise_id, photo_url');
    if (error) throw new Error(error.message);
    return new Map(
      ((data ?? []) as { exercise_id: string; photo_url: string }[]).map((row) => [
        row.exercise_id,
        row.photo_url,
      ]),
    );
  },
  async save(exerciseId, localUri) {
    const userId = await signedInUserId();
    const url = await uploadEquipmentPhoto(userId, localUri);
    const { error } = await supabase
      .from('exercise_user_photos')
      .upsert({ user_id: userId, exercise_id: exerciseId, photo_url: url });
    if (error) throw new Error(error.message);
    return url;
  },
  async remove(exerciseId) {
    const userId = await signedInUserId();
    const { error } = await supabase
      .from('exercise_user_photos')
      .delete()
      .eq('user_id', userId)
      .eq('exercise_id', exerciseId);
    if (error) throw new Error(error.message);
  },
});

// Each person's photos are their own: forgotten as anyone signs out or in. (A test's stand-in
// client may have no auth to listen to.)
supabase.auth?.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') forgetOwnPhotos();
});
