import { BadRequestException, HttpException, NotFoundException } from '@nestjs/common';
import type { SupabaseService } from '../supabase/supabase.service';
import { FeedbackService, searchTerm } from './feedback.service';

type Call = [string, ...unknown[]];
interface Result {
  data?: unknown;
  error?: { message: string } | null;
  count?: number | null;
}

// Every chained call is recorded per query, and each query's result comes from `resolve`, which
// sees the table and the calls -- so one test can answer a count, an insert and a read on the
// same table differently, as the real client would.
function mockSupabase(resolve: (table: string, calls: Call[]) => Result) {
  const queries: { table: string; calls: Call[] }[] = [];
  const from = jest.fn((table: string) => {
    const calls: Call[] = [];
    queries.push({ table, calls });
    const builder: Record<string, unknown> = {};
    for (const method of [
      'select',
      'insert',
      'update',
      'eq',
      'gte',
      'lt',
      'in',
      'or',
      'order',
      'limit',
    ]) {
      builder[method] = jest.fn((...args: unknown[]) => {
        calls.push([method, ...args]);
        return builder;
      });
    }
    const settle = (end: string) =>
      Promise.resolve({ error: null, ...resolve(table, [...calls, [end]]) });
    builder.single = jest.fn(() => settle('single'));
    builder.maybeSingle = jest.fn(() => settle('maybeSingle'));
    builder.then = (ok: (v: unknown) => unknown, fail: (e: unknown) => unknown) =>
      Promise.resolve({ error: null, ...resolve(table, calls) }).then(ok, fail);
    return builder;
  });
  const list = jest.fn().mockResolvedValue({ data: [], error: null });
  const createSignedUrl = jest
    .fn()
    .mockResolvedValue({ data: { signedUrl: 'https://signed.example/shot.png' }, error: null });
  const storage = { from: jest.fn(() => ({ list, createSignedUrl })) };
  const supabaseService = { getClient: () => ({ from, storage }) } as unknown as SupabaseService;
  const callsTo = (table: string, method: string) =>
    queries
      .filter((query) => query.table === table)
      .flatMap((query) =>
        query.calls.filter(([name]) => name === method).map(([, ...args]) => args),
      );
  return { supabaseService, queries, list, createSignedUrl, callsTo };
}

const isCount = (calls: Call[]) =>
  calls.some(([method, , options]) => method === 'select' && (options as { head?: boolean })?.head);

const USER = '11111111-1111-4111-8111-111111111111';
const ADMIN = '99999999-9999-4999-8999-999999999999';
const SUBMISSION = '22222222-2222-4222-8222-222222222222';

function row(extra: Record<string, unknown> = {}) {
  return {
    id: SUBMISSION,
    user_id: USER,
    category: 'bug',
    title: 'Swipe skips a day',
    description: 'Swiping left went two days ahead.',
    screenshot_path: null,
    app_version: '1.4.0',
    build_number: '31',
    platform: 'ios',
    os_version: '18.1',
    status: 'new',
    status_changed_at: '2026-10-25T12:00:00Z',
    created_at: '2026-10-25T12:00:00Z',
    ...extra,
  };
}

const dto = {
  category: 'bug' as const,
  title: 'Swipe skips a day',
  description: 'Swiping left went two days ahead.',
  appVersion: '1.4.0',
  buildNumber: '31',
  platform: 'ios' as const,
  osVersion: '18.1',
};

describe('FeedbackService -- sending', () => {
  it('sends it as the signed-in person, captured version and platform with it', async () => {
    const { supabaseService, callsTo } = mockSupabase((table, calls) =>
      isCount(calls) ? { count: 0 } : { data: row() },
    );
    const service = new FeedbackService(supabaseService);

    const sent = await service.create(USER, dto);

    expect(callsTo('feedback_submissions', 'insert')).toEqual([
      [
        {
          user_id: USER,
          category: 'bug',
          title: 'Swipe skips a day',
          description: 'Swiping left went two days ahead.',
          screenshot_path: null,
          app_version: '1.4.0',
          build_number: '31',
          platform: 'ios',
          os_version: '18.1',
        },
      ],
    ]);
    // A status is never taken from the request: it starts as the table's own default.
    expect(JSON.stringify(callsTo('feedback_submissions', 'insert'))).not.toContain('status');
    expect(sent).toMatchObject({
      id: SUBMISSION,
      userId: USER,
      status: 'new',
      appVersion: '1.4.0',
    });
  });

  it('refuses a sixth in an hour, without writing anything', async () => {
    const { supabaseService, callsTo } = mockSupabase((_table, calls) =>
      isCount(calls) ? { count: 5 } : { data: row() },
    );
    const service = new FeedbackService(supabaseService);

    const attempt = service.create(USER, dto);

    await expect(attempt).rejects.toBeInstanceOf(HttpException);
    await expect(attempt).rejects.toMatchObject({ status: 429 });
    expect(callsTo('feedback_submissions', 'insert')).toEqual([]);
  });

  it('refuses the 21st in a day, even with the hour quiet', async () => {
    let counted = 0;
    const { supabaseService, callsTo } = mockSupabase((_table, calls) => {
      if (!isCount(calls)) return { data: row() };
      counted += 1;
      return { count: counted === 1 ? 1 : 20 };
    });
    const service = new FeedbackService(supabaseService);

    await expect(service.create(USER, dto)).rejects.toMatchObject({ status: 429 });
    expect(callsTo('feedback_submissions', 'insert')).toEqual([]);
  });

  it("refuses a screenshot in someone else's folder", async () => {
    const { supabaseService, list } = mockSupabase((_table, calls) =>
      isCount(calls) ? { count: 0 } : { data: row() },
    );
    const service = new FeedbackService(supabaseService);

    await expect(
      service.create(USER, { ...dto, screenshotPath: `${ADMIN}/shot.png` }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(list).not.toHaveBeenCalled();
  });

  it("refuses a screenshot that isn't there", async () => {
    const { supabaseService, list, callsTo } = mockSupabase((_table, calls) =>
      isCount(calls) ? { count: 0 } : { data: row() },
    );
    list.mockResolvedValue({ data: [{ name: 'another.png' }], error: null });
    const service = new FeedbackService(supabaseService);

    await expect(
      service.create(USER, { ...dto, screenshotPath: `${USER}/shot.png` }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(list).toHaveBeenCalledWith(USER, { search: 'shot.png', limit: 10 });
    expect(callsTo('feedback_submissions', 'insert')).toEqual([]);
  });

  it('keeps a screenshot of their own that was uploaded', async () => {
    const { supabaseService, list, callsTo } = mockSupabase((_table, calls) =>
      isCount(calls) ? { count: 0 } : { data: row({ screenshot_path: `${USER}/shot.png` }) },
    );
    list.mockResolvedValue({ data: [{ name: 'shot.png' }], error: null });
    const service = new FeedbackService(supabaseService);

    const sent = await service.create(USER, { ...dto, screenshotPath: `${USER}/shot.png` });

    expect(callsTo('feedback_submissions', 'insert')[0]![0]).toMatchObject({
      screenshot_path: `${USER}/shot.png`,
    });
    expect(sent.screenshotPath).toBe(`${USER}/shot.png`);
  });
});

describe('FeedbackService -- the inbox', () => {
  it('filters, searches safely, counts each status and pages', async () => {
    const page = Array.from({ length: 31 }, (_, i) =>
      row({
        id: `id-${i}`,
        created_at: `2026-10-${String(25 - (i % 20)).padStart(2, '0')}T12:00:00Z`,
      }),
    );
    const { supabaseService, callsTo, queries } = mockSupabase((table, calls) => {
      if (table === 'users')
        return { data: [{ id: USER, display_name: 'Harbir', username: 'harbir' }] };
      if (isCount(calls)) return { count: 2 };
      return { data: page };
    });
    const service = new FeedbackService(supabaseService);

    const inbox = await service.list({
      status: 'new',
      category: 'bug',
      q: 'drop,table%(x)',
      before: '2026-10-26T00:00:00Z',
    });

    const listQuery = queries.find(
      (query) => query.table === 'feedback_submissions' && !isCount(query.calls),
    )!;
    expect(listQuery.calls).toEqual(
      expect.arrayContaining([
        ['eq', 'status', 'new'],
        ['eq', 'category', 'bug'],
        ['lt', 'created_at', '2026-10-26T00:00:00Z'],
        ['or', 'title.ilike.%drop table x%,description.ilike.%drop table x%'],
      ]),
    );
    expect(inbox.items).toHaveLength(30);
    expect(inbox.items[0]!.sender).toEqual({ id: USER, displayName: 'Harbir', username: 'harbir' });
    expect(inbox.nextBefore).toBe(page[29]!.created_at);
    expect(inbox.counts).toEqual({
      new: 2,
      reviewing: 2,
      planned: 2,
      in_progress: 2,
      completed: 2,
      declined: 2,
    });
    expect(callsTo('users', 'select')).toEqual([['id, display_name, username']]);
  });

  it('opens one with its history, its notes and a short-lived screenshot link', async () => {
    const { supabaseService, createSignedUrl } = mockSupabase((table) => {
      if (table === 'feedback_submissions')
        return { data: row({ screenshot_path: `${USER}/shot.png` }) };
      if (table === 'feedback_status_events') {
        return {
          data: [
            { status: 'new', created_at: '2026-10-25T12:00:00Z' },
            { status: 'planned', created_at: '2026-10-25T13:00:00Z' },
          ],
        };
      }
      if (table === 'feedback_notes') {
        return {
          data: [
            {
              id: 'note-1',
              body: 'Repro on 18.1',
              author_id: ADMIN,
              created_at: '2026-10-25T13:05:00Z',
            },
          ],
        };
      }
      return {
        data: [
          { id: USER, display_name: 'Harbir', username: 'harbir' },
          { id: ADMIN, display_name: 'Support', username: null },
        ],
      };
    });
    const service = new FeedbackService(supabaseService);

    const review = await service.get(SUBMISSION);

    expect(createSignedUrl).toHaveBeenCalledWith(`${USER}/shot.png`, 600);
    expect(review.screenshotUrl).toBe('https://signed.example/shot.png');
    expect(review.history).toEqual([
      { status: 'new', at: '2026-10-25T12:00:00Z' },
      { status: 'planned', at: '2026-10-25T13:00:00Z' },
    ]);
    expect(review.notes).toEqual([
      {
        id: 'note-1',
        body: 'Repro on 18.1',
        createdAt: '2026-10-25T13:05:00Z',
        author: { id: ADMIN, displayName: 'Support' },
      },
    ]);
  });

  it('404s feedback that is not there', async () => {
    const { supabaseService } = mockSupabase(() => ({ data: null }));
    const service = new FeedbackService(supabaseService);

    await expect(service.get(SUBMISSION)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('FeedbackService -- moving it on', () => {
  it('changes the status and records which admin did, from and to', async () => {
    let status = 'new';
    const { supabaseService, callsTo } = mockSupabase((table, calls) => {
      if (table === 'feedback_submissions') {
        if (calls.some(([method]) => method === 'update')) {
          status = 'planned';
          return {};
        }
        return { data: row({ status }) };
      }
      return { data: [] };
    });
    const service = new FeedbackService(supabaseService);

    const review = await service.updateStatus(ADMIN, SUBMISSION, 'planned');

    expect(callsTo('feedback_submissions', 'update')).toEqual([[{ status: 'planned' }]]);
    expect(callsTo('admin_actions', 'insert')).toEqual([
      [
        {
          admin_id: ADMIN,
          action: 'feedback.status_changed',
          target_table: 'feedback_submissions',
          target_id: SUBMISSION,
          details: { from: 'new', to: 'planned' },
        },
      ],
    ]);
    expect(review.status).toBe('planned');
  });

  it('changes and records nothing when it already has that status', async () => {
    const { supabaseService, callsTo } = mockSupabase((table) =>
      table === 'feedback_submissions' ? { data: row({ status: 'planned' }) } : { data: [] },
    );
    const service = new FeedbackService(supabaseService);

    await service.updateStatus(ADMIN, SUBMISSION, 'planned');

    expect(callsTo('feedback_submissions', 'update')).toEqual([]);
    expect(callsTo('admin_actions', 'insert')).toEqual([]);
  });

  it('adds an internal note as its admin, and records it without its text', async () => {
    const { supabaseService, callsTo } = mockSupabase((table, calls) => {
      if (table === 'feedback_submissions') return { data: row() };
      if (table === 'feedback_notes' && calls.some(([method]) => method === 'insert')) {
        return { data: { id: 'note-1' } };
      }
      return { data: [] };
    });
    const service = new FeedbackService(supabaseService);

    await service.addNote(ADMIN, SUBMISSION, 'Asked for a video');

    expect(callsTo('feedback_notes', 'insert')).toEqual([
      [{ submission_id: SUBMISSION, author_id: ADMIN, body: 'Asked for a video' }],
    ]);
    const audit = callsTo('admin_actions', 'insert');
    expect(audit).toEqual([
      [expect.objectContaining({ action: 'feedback.note_added', details: { noteId: 'note-1' } })],
    ]);
    expect(JSON.stringify(audit)).not.toContain('Asked for a video');
  });

  it('adds no note, and records nothing, to feedback that is not there', async () => {
    const { supabaseService, callsTo } = mockSupabase(() => ({ data: null }));
    const service = new FeedbackService(supabaseService);

    await expect(service.addNote(ADMIN, SUBMISSION, 'Hello')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(callsTo('feedback_notes', 'insert')).toEqual([]);
    expect(callsTo('admin_actions', 'insert')).toEqual([]);
  });
});

describe('searchTerm', () => {
  it("keeps the words and drops what would change the search's meaning", () => {
    expect(searchTerm('swipe, (left) 100% "now"\\*')).toBe('swipe left 100 now');
    expect(searchTerm('  dark   mode ')).toBe('dark mode');
    expect(searchTerm('%_')).toBe('');
  });
});
