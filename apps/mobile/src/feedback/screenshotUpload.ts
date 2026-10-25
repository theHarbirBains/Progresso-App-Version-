import * as ImageManipulator from 'expo-image-manipulator';
import { resizeForUpload } from '../lib/imageResize';
import { supabase } from '../lib/supabase';

/** Private: read through signed links only (20261026100000_feedback_board.sql). */
export const FEEDBACK_SCREENSHOT_BUCKET = 'feedback-screenshots';

function screenshotPath(userId: string): string {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${userId}/${unique}.jpg`;
}

/**
 * Uploads a picked screenshot (a file:// URI from expo-image-picker) into the sender's own folder
 * of the feedback-screenshots bucket -- Storage RLS allows nothing else -- and returns its path,
 * for the feedback to point at. Always as JPEG: the bucket takes only JPEG or PNG, and a photo
 * from the library can be HEIC.
 */
export async function uploadFeedbackScreenshot(userId: string, localUri: string): Promise<string> {
  const resized = await resizeForUpload(localUri);
  const jpeg = await ImageManipulator.manipulateAsync(resized, [], {
    compress: 0.85,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  const blob = await (await fetch(jpeg.uri)).blob();
  const path = screenshotPath(userId);
  const { error } = await supabase.storage
    .from(FEEDBACK_SCREENSHOT_BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg' });
  if (error) throw new Error(error.message);
  return path;
}

/** Takes back a screenshot whose feedback didn't send. Best effort: a failure here changes nothing. */
export async function removeUnsentScreenshot(path: string): Promise<void> {
  await supabase.storage
    .from(FEEDBACK_SCREENSHOT_BUCKET)
    .remove([path])
    .catch(() => undefined);
}
