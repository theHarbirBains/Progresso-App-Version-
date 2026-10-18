import { enrichWorkoutSummaries } from '../workouts/workoutHistoryEnrichment';
import { fetchWorkoutHistory } from '../workouts/workoutQueries';
import { ACTIVITY_LIMIT, fetchClientsActivity } from './clientQueries';

jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn() } }));

jest.mock('../workouts/workoutQueries', () => ({
  fetchWorkoutHistory: jest.fn(),
}));

jest.mock('../workouts/workoutHistoryEnrichment', () => ({
  enrichWorkoutSummaries: jest.fn(),
}));

const mockFetchWorkoutHistory = fetchWorkoutHistory as jest.Mock;
const mockEnrich = enrichWorkoutSummaries as jest.Mock;

function row(id: string, performedAt: string, completedAt: string | null = performedAt) {
  return { id, name: id, performedAt, completedAt, workoutSplitDayId: null };
}

beforeEach(() => {
  mockFetchWorkoutHistory.mockReset();
  mockEnrich.mockReset();
  // Enrichment keeps each row's id, which is all the merge relies on.
  mockEnrich.mockImplementation(async (rows: { id: string }[]) =>
    rows.map((r) => ({ ...r, enriched: true })),
  );
});

describe('fetchClientsActivity', () => {
  it("merges every client's latest workouts into one feed, newest first, with whose each is", async () => {
    mockFetchWorkoutHistory.mockImplementation(async (clientId: string) => ({
      rows:
        clientId === 'sam'
          ? [row('s2', '2026-10-15T10:00:00Z'), row('s1', '2026-10-10T10:00:00Z')]
          : [row('a1', '2026-10-12T10:00:00Z')],
      hasMore: false,
    }));

    const items = await fetchClientsActivity([
      { clientId: 'sam', name: 'Sam' },
      { clientId: 'ana', name: 'Ana' },
    ]);

    expect(items.map((item) => [item.workout.id, item.clientName])).toEqual([
      ['s2', 'Sam'],
      ['a1', 'Ana'],
      ['s1', 'Sam'],
    ]);
    expect(items[0]).toMatchObject({ clientId: 'sam', workout: { enriched: true } });
    expect(mockEnrich).toHaveBeenCalledTimes(1);
  });

  it("leaves out a client whose workouts can't be read, and still shows the rest", async () => {
    mockFetchWorkoutHistory.mockImplementation(async (clientId: string) => {
      if (clientId === 'gone') throw new Error('permission denied');
      return { rows: [row('a1', '2026-10-12T10:00:00Z')], hasMore: false };
    });

    const items = await fetchClientsActivity([
      { clientId: 'gone', name: 'Gone' },
      { clientId: 'ana', name: 'Ana' },
    ]);

    expect(items.map((item) => item.workout.id)).toEqual(['a1']);
  });

  it('skips a workout still in progress, and reads nothing more when there is nothing to show', async () => {
    mockFetchWorkoutHistory.mockResolvedValue({
      rows: [row('live', '2026-10-17T09:00:00Z', null)],
      hasMore: false,
    });

    expect(await fetchClientsActivity([{ clientId: 'sam', name: 'Sam' }])).toEqual([]);
    expect(mockEnrich).not.toHaveBeenCalled();
  });

  it(`shows at most ${ACTIVITY_LIMIT} workouts`, async () => {
    mockFetchWorkoutHistory.mockImplementation(async (clientId: string) => ({
      rows: Array.from({ length: 5 }, (_, i) =>
        row(`${clientId}-${i}`, new Date(Date.UTC(2026, 9, 1 + i)).toISOString()),
      ),
      hasMore: true,
    }));
    const clients = Array.from({ length: 10 }, (_, i) => ({ clientId: `c${i}`, name: `C${i}` }));

    expect(await fetchClientsActivity(clients)).toHaveLength(ACTIVITY_LIMIT);
  });
});
