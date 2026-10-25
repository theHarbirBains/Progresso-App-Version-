import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * The Storage buckets that hold a person's own photos -- and the screenshots they sent with
 * feedback -- each under a folder named for them.
 */
const PHOTO_BUCKETS = [
  'avatars',
  'equipment-photos',
  'food-photos',
  'feedback-screenshots',
] as const;
const LIST_PAGE = 100;
/** 5,000 photos a bucket: far past anyone's, and a stop should a removal not take. */
const MAX_PAGES = 50;

/**
 * Deletes the signed-in person's account and everything it owns
 * (20261020110000_account_deletion.sql): their photos from Storage, then their data and the
 * guests they added (delete_account), then the auth accounts, whose cascades remove the rest.
 *
 * Photos go first. If anything after that fails the account is still there to delete again,
 * and every step is safe to repeat.
 */
@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async deleteAccount(userId: string): Promise<void> {
    await this.removePhotos(userId);

    const client = this.supabaseService.getClient();
    const { data, error } = await client.rpc('delete_account', { p_user: userId });
    if (error) {
      this.logger.error(`delete_account failed: ${error.message}`);
      throw new InternalServerErrorException('Could not delete your account');
    }

    // Theirs first; the guests they added can't sign in, so a failure there is only logged.
    const accounts = ((data as string[] | null) ?? [userId]).filter(Boolean);
    for (const id of accounts) {
      const { error: authError } = await client.auth.admin.deleteUser(id);
      if (authError && id === userId) {
        this.logger.error(`deleteUser failed: ${authError.message}`);
        throw new InternalServerErrorException('Could not delete your account');
      }
      if (authError) this.logger.warn(`Could not delete a guest account: ${authError.message}`);
    }
  }

  private async removePhotos(userId: string): Promise<void> {
    const storage = this.supabaseService.getClient().storage;
    for (const bucket of PHOTO_BUCKETS) {
      // Removing a page shifts the rest up, so keep taking the first page until it's empty.
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const { data, error } = await storage.from(bucket).list(userId, { limit: LIST_PAGE });
        if (error) {
          this.logger.error(`Listing ${bucket} failed: ${error.message}`);
          throw new InternalServerErrorException('Could not delete your photos');
        }
        const paths = (data ?? [])
          .filter((file) => file.name && file.id !== null)
          .map((file) => `${userId}/${file.name}`);
        if (paths.length === 0) break;
        const { error: removeError } = await storage.from(bucket).remove(paths);
        if (removeError) {
          this.logger.error(`Removing from ${bucket} failed: ${removeError.message}`);
          throw new InternalServerErrorException('Could not delete your photos');
        }
        if (paths.length < LIST_PAGE) break;
      }
    }
  }
}
