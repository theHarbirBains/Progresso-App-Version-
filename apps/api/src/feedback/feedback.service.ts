import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { ListFeedbackQueryDto } from './dto/admin-feedback.dto';
import type { CreateFeedbackDto } from './dto/create-feedback.dto';
import {
  FEEDBACK_SCREENSHOT_BUCKET,
  FEEDBACK_STATUSES,
  type FeedbackCategory,
  type FeedbackStatus,
} from './feedback.constants';

const SUBMISSION_COLUMNS =
  'id, user_id, category, title, description, screenshot_path, app_version, build_number, platform, os_version, status, status_changed_at, created_at';
const PAGE_SIZE = 30;
/** How long an admin's link to a screenshot works. */
const SCREENSHOT_LINK_SECONDS = 600;

/** How much one person can send: a few an hour, more over a day. */
const SEND_LIMITS = [
  {
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: "You've sent a lot of feedback in the last hour. Try again later.",
  },
  {
    windowMs: 24 * 60 * 60 * 1000,
    max: 20,
    message: "You've sent a lot of feedback today. Try again tomorrow.",
  },
];

interface SubmissionRow {
  id: string;
  user_id: string;
  category: FeedbackCategory;
  title: string;
  description: string;
  screenshot_path: string | null;
  app_version: string | null;
  build_number: string | null;
  platform: string | null;
  os_version: string | null;
  status: FeedbackStatus;
  status_changed_at: string;
  created_at: string;
}

export interface FeedbackSubmission {
  id: string;
  userId: string;
  category: FeedbackCategory;
  title: string;
  description: string;
  screenshotPath: string | null;
  appVersion: string | null;
  buildNumber: string | null;
  platform: string | null;
  osVersion: string | null;
  status: FeedbackStatus;
  statusChangedAt: string;
  createdAt: string;
}

/** Who sent it, as the inbox shows them: their name, never their email. */
export interface FeedbackSender {
  id: string;
  displayName: string | null;
  username: string | null;
}

export interface FeedbackInboxItem extends FeedbackSubmission {
  sender: FeedbackSender;
}

export interface FeedbackInbox {
  items: FeedbackInboxItem[];
  /** How many there are of each status, across the whole inbox. */
  counts: Record<FeedbackStatus, number>;
  /** Pass as `before` for the next page; null when this is the last. */
  nextBefore: string | null;
}

export interface FeedbackNote {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; displayName: string | null } | null;
}

export interface FeedbackReview extends FeedbackInboxItem {
  /** A short-lived link to the screenshot, or null without one. */
  screenshotUrl: string | null;
  history: { status: FeedbackStatus; at: string }[];
  notes: FeedbackNote[];
}

function toSubmission(row: SubmissionRow): FeedbackSubmission {
  return {
    id: row.id,
    userId: row.user_id,
    category: row.category,
    title: row.title,
    description: row.description,
    screenshotPath: row.screenshot_path,
    appVersion: row.app_version,
    buildNumber: row.build_number,
    platform: row.platform,
    osVersion: row.os_version,
    status: row.status,
    statusChangedAt: row.status_changed_at,
    createdAt: row.created_at,
  };
}

/**
 * Words to look for, safe inside a PostgREST `or` filter: what would end the filter early (commas,
 * brackets, quotes) or match more than the words (the LIKE wildcards, a backslash) is left out.
 */
export function searchTerm(q: string): string {
  return q
    .replace(/[%_,()"\\*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Feedback & Suggestions: a person sending feedback, and the inbox support and full admins read
 * it in. The table's own rules (RLS, checks, the history trigger) hold whatever this does; this is
 * what's checked before a write, and the record of every admin action (admin_actions).
 */
@Injectable()
export class FeedbackService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async create(userId: string, dto: CreateFeedbackDto): Promise<FeedbackSubmission> {
    await this.enforceSendLimits(userId);
    if (dto.screenshotPath) await this.requireOwnScreenshot(userId, dto.screenshotPath);

    const { data, error } = await this.supabaseService
      .getClient()
      .from('feedback_submissions')
      .insert({
        user_id: userId,
        category: dto.category,
        title: dto.title,
        description: dto.description,
        screenshot_path: dto.screenshotPath ?? null,
        app_version: dto.appVersion ?? null,
        build_number: dto.buildNumber ?? null,
        platform: dto.platform ?? null,
        os_version: dto.osVersion ?? null,
      })
      .select(SUBMISSION_COLUMNS)
      .single();
    if (error || !data) throw new InternalServerErrorException('Failed to send your feedback');
    return toSubmission(data as SubmissionRow);
  }

  async list(query: ListFeedbackQueryDto): Promise<FeedbackInbox> {
    const client = this.supabaseService.getClient();
    let request = client
      .from('feedback_submissions')
      .select(SUBMISSION_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE + 1);
    if (query.status) request = request.eq('status', query.status);
    if (query.category) request = request.eq('category', query.category);
    if (query.before) request = request.lt('created_at', query.before);
    const term = query.q ? searchTerm(query.q) : '';
    if (term) request = request.or(`title.ilike.%${term}%,description.ilike.%${term}%`);

    const [{ data, error }, counts] = await Promise.all([request, this.statusCounts()]);
    if (error) throw new InternalServerErrorException('Failed to load feedback');
    const rows = (data ?? []) as SubmissionRow[];
    const page = rows.slice(0, PAGE_SIZE);
    const senders = await this.senders(page.map((row) => row.user_id));
    return {
      items: page.map((row) => ({ ...toSubmission(row), sender: senders(row.user_id) })),
      counts,
      nextBefore: rows.length > PAGE_SIZE ? page[page.length - 1]!.created_at : null,
    };
  }

  async get(id: string): Promise<FeedbackReview> {
    const client = this.supabaseService.getClient();
    const row = await this.requireSubmission(id);
    const [history, notes, senders, screenshotUrl] = await Promise.all([
      client
        .from('feedback_status_events')
        .select('status, created_at')
        .eq('submission_id', id)
        .order('created_at', { ascending: true }),
      client
        .from('feedback_notes')
        .select('id, body, author_id, created_at')
        .eq('submission_id', id)
        .order('created_at', { ascending: true }),
      this.senders([row.user_id]),
      this.screenshotLink(row.screenshot_path),
    ]);
    if (history.error || notes.error) {
      throw new InternalServerErrorException('Failed to load the feedback');
    }
    const noteRows = (notes.data ?? []) as {
      id: string;
      body: string;
      author_id: string | null;
      created_at: string;
    }[];
    const authors = await this.senders(
      noteRows.flatMap((note) => (note.author_id ? [note.author_id] : [])),
    );
    return {
      ...toSubmission(row),
      sender: senders(row.user_id),
      screenshotUrl,
      history: ((history.data ?? []) as { status: FeedbackStatus; created_at: string }[]).map(
        (event) => ({ status: event.status, at: event.created_at }),
      ),
      notes: noteRows.map((note) => ({
        id: note.id,
        body: note.body,
        createdAt: note.created_at,
        author: note.author_id
          ? { id: note.author_id, displayName: authors(note.author_id).displayName }
          : null,
      })),
    };
  }

  /** Moves a submission on -- the history trigger keeps it -- and records who did. */
  async updateStatus(adminId: string, id: string, status: FeedbackStatus): Promise<FeedbackReview> {
    const current = await this.requireSubmission(id);
    if (current.status !== status) {
      const { error } = await this.supabaseService
        .getClient()
        .from('feedback_submissions')
        .update({ status })
        .eq('id', id);
      if (error) throw new InternalServerErrorException('Failed to change the status');
      await this.audit(adminId, 'feedback.status_changed', id, {
        from: current.status,
        to: status,
      });
    }
    return this.get(id);
  }

  /** An internal note, for admins only, and a record that it was added (never its text). */
  async addNote(adminId: string, id: string, body: string): Promise<FeedbackReview> {
    await this.requireSubmission(id);
    const { data, error } = await this.supabaseService
      .getClient()
      .from('feedback_notes')
      .insert({ submission_id: id, author_id: adminId, body })
      .select('id')
      .single();
    if (error || !data) throw new InternalServerErrorException('Failed to add the note');
    await this.audit(adminId, 'feedback.note_added', id, { noteId: (data as { id: string }).id });
    return this.get(id);
  }

  private async enforceSendLimits(userId: string): Promise<void> {
    const client = this.supabaseService.getClient();
    for (const limit of SEND_LIMITS) {
      const since = new Date(Date.now() - limit.windowMs).toISOString();
      const { count, error } = await client
        .from('feedback_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', since);
      if (error) throw new InternalServerErrorException('Failed to send your feedback');
      if ((count ?? 0) >= limit.max) {
        throw new HttpException(limit.message, HttpStatus.TOO_MANY_REQUESTS);
      }
    }
  }

  /** The screenshot is in the sender's own folder, and was really uploaded. */
  private async requireOwnScreenshot(userId: string, path: string): Promise<void> {
    const [folder, name] = path.split('/');
    if (folder !== userId || !name) throw new BadRequestException("That screenshot isn't yours");
    const { data, error } = await this.supabaseService
      .getClient()
      .storage.from(FEEDBACK_SCREENSHOT_BUCKET)
      .list(userId, { search: name, limit: 10 });
    if (error) throw new InternalServerErrorException('Failed to check the screenshot');
    if (!(data ?? []).some((object) => object.name === name)) {
      throw new BadRequestException("The screenshot didn't upload. Add it again.");
    }
  }

  private async requireSubmission(id: string): Promise<SubmissionRow> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('feedback_submissions')
      .select(SUBMISSION_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to load the feedback');
    if (!data) throw new NotFoundException('Feedback not found');
    return data as SubmissionRow;
  }

  private async statusCounts(): Promise<Record<FeedbackStatus, number>> {
    const client = this.supabaseService.getClient();
    const results = await Promise.all(
      FEEDBACK_STATUSES.map((status) =>
        client
          .from('feedback_submissions')
          .select('id', { count: 'exact', head: true })
          .eq('status', status),
      ),
    );
    const counts = {} as Record<FeedbackStatus, number>;
    FEEDBACK_STATUSES.forEach((status, index) => {
      const { count, error } = results[index]!;
      if (error) throw new InternalServerErrorException('Failed to load feedback');
      counts[status] = count ?? 0;
    });
    return counts;
  }

  /** Each sender's name, looked up together; one that's gone shows as nobody. */
  private async senders(ids: string[]): Promise<(id: string) => FeedbackSender> {
    const unique = [...new Set(ids)];
    const byId = new Map<string, FeedbackSender>();
    if (unique.length > 0) {
      const { data, error } = await this.supabaseService
        .getClient()
        .from('users')
        .select('id, display_name, username')
        .in('id', unique);
      if (error) throw new InternalServerErrorException('Failed to load feedback');
      for (const user of (data ?? []) as {
        id: string;
        display_name: string | null;
        username: string | null;
      }[]) {
        byId.set(user.id, { id: user.id, displayName: user.display_name, username: user.username });
      }
    }
    return (id) => byId.get(id) ?? { id, displayName: null, username: null };
  }

  private async screenshotLink(path: string | null): Promise<string | null> {
    if (!path) return null;
    const { data, error } = await this.supabaseService
      .getClient()
      .storage.from(FEEDBACK_SCREENSHOT_BUCKET)
      .createSignedUrl(path, SCREENSHOT_LINK_SECONDS);
    // A screenshot that can't be linked is left out rather than failing the whole page.
    if (error || !data) return null;
    return data.signedUrl;
  }

  private async audit(
    adminId: string,
    action: string,
    targetId: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    const { error } = await this.supabaseService.getClient().from('admin_actions').insert({
      admin_id: adminId,
      action,
      target_table: 'feedback_submissions',
      target_id: targetId,
      details,
    });
    if (error) throw new InternalServerErrorException('Failed to record the admin action');
  }
}
