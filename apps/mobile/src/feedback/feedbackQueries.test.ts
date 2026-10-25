import { supabase } from '../lib/supabase';
import { fetchMyFeedback, fetchMyFeedbackDetail } from './feedbackQueries';

jest.mock('../lib/supabase', () => ({
  supabase: { from: jest.fn(), storage: { from: jest.fn() } },
}));

const mockFrom = supabase.from as jest.Mock;
const mockStorageFrom = supabase.storage.from as jest.Mock;

function query(result: { data: unknown; error: { message: string } | null }) {
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'order']) builder[method] = jest.fn(() => builder);
  builder.maybeSingle = jest.fn().mockResolvedValue(result);
  builder.then = (ok: (v: unknown) => unknown) => Promise.resolve(result).then(ok);
  return builder;
}

const row = {
  id: 'fb-1',
  user_id: 'user-1',
  category: 'bug',
  title: 'Swipe skips a day',
  description: 'It went two days ahead.',
  screenshot_path: 'user-1/a.jpg',
  app_version: '1.4.0',
  build_number: '31',
  platform: 'ios',
  os_version: '18.1',
  status: 'planned',
  status_changed_at: '2026-10-25T13:00:00Z',
  created_at: '2026-10-25T12:00:00Z',
};

beforeEach(() => {
  mockFrom.mockReset();
  mockStorageFrom.mockReset();
});

describe('fetchMyFeedback', () => {
  it("reads the person's own feedback, newest first", async () => {
    const builder = query({ data: [row], error: null });
    mockFrom.mockReturnValue(builder);

    const items = await fetchMyFeedback('user-1');

    expect(mockFrom).toHaveBeenCalledWith('feedback_submissions');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(items).toEqual([
      expect.objectContaining({ id: 'fb-1', status: 'planned', screenshotPath: 'user-1/a.jpg' }),
    ]);
  });

  it('throws on a read error', async () => {
    mockFrom.mockReturnValue(query({ data: null, error: { message: 'offline' } }));

    await expect(fetchMyFeedback('user-1')).rejects.toThrow('offline');
  });
});

describe('fetchMyFeedbackDetail', () => {
  it('reads one with its status history and a link to their own screenshot', async () => {
    mockFrom.mockImplementation((table: string) =>
      table === 'feedback_submissions'
        ? query({ data: row, error: null })
        : query({
            data: [
              { status: 'new', created_at: '2026-10-25T12:00:00Z' },
              { status: 'planned', created_at: '2026-10-25T13:00:00Z' },
            ],
            error: null,
          }),
    );
    const createSignedUrl = jest
      .fn()
      .mockResolvedValue({ data: { signedUrl: 'https://signed/a.jpg' }, error: null });
    mockStorageFrom.mockReturnValue({ createSignedUrl });

    const detail = await fetchMyFeedbackDetail('fb-1');

    expect(mockStorageFrom).toHaveBeenCalledWith('feedback-screenshots');
    expect(createSignedUrl).toHaveBeenCalledWith('user-1/a.jpg', 3600);
    expect(detail.screenshotUrl).toBe('https://signed/a.jpg');
    expect(detail.history).toEqual([
      { status: 'new', at: '2026-10-25T12:00:00Z' },
      { status: 'planned', at: '2026-10-25T13:00:00Z' },
    ]);
  });

  it("says so when it isn't theirs to see, or isn't there", async () => {
    mockFrom.mockReturnValue(query({ data: null, error: null }));

    await expect(fetchMyFeedbackDetail('fb-9')).rejects.toThrow('could not be found');
  });
});
