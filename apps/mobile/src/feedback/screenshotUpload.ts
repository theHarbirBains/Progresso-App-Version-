import { uniquePhotoPath, uploadPhoto } from '../lib/photoUpload';
import { supabase } from '../lib/supabase';

/** Private: read through signed links only (20261026100000_feedback_board.sql). */
export const FEEDBACK_SCREENSHOT_BUCKET = 'feedback-screenshots';

/**
 * Uploads a picked screenshot (a file:// URI from expo-image-picker) into the sender's own folder
 * of the feedback-screenshots bucket -- Storage RLS allows nothing else -- and returns its path,
 * for the feedback to point at. Always as JPEG: the bucket takes only JPEG or PNG, and a photo
 * from the library can be HEIC.
 */
export async function uploadFeedbackScreenshot(userId: string, localUri: string): Promise<string> {
  const path = uniquePhotoPath(userId);
  await uploadPhoto(FEEDBACK_SCREENSHOT_BUCKET, path, localUri, { asJpeg: true });
  return path;
}

/** Takes back a screenshot whose feedback didn't send. Best effort: a failure here changes nothing. */
export async function removeUnsentScreenshot(path: string): Promise<void> {
  await supabase.storage
    .from(FEEDBACK_SCREENSHOT_BUCKET)
    .remove([path])
    .catch(() => undefined);
}
