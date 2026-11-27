import { HttpStatus } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { SupabaseService } from '../supabase/supabase.service';
import { HealthDataService } from './health-data.service';

const ME = '11111111-1111-4111-8111-111111111111';

type Result = { data: unknown; error: { message: string } | null };

/** The rpc calls and table reads, each answered in turn; every call recorded. */
function setup(options: {
  enabled?: boolean;
  rpc?: Record<string, Result | Result[]>;
  tables?: Record<string, Result>;
}) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const tableCalls: { fn: string; args: unknown[] }[] = [];
  const used: Record<string, number> = {};
  const rpc = jest.fn(async (fn: string, args: Record<string, unknown>) => {
    calls.push({ fn, args });
    const answers = options.rpc?.[fn];
    const index = used[fn] ?? 0;
    used[fn] = index + 1;
    if (Array.isArray(answers)) return answers[index] ?? answers[answers.length - 1];
    return answers ?? { data: null, error: null };
  });
  const from = jest.fn((table: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {};
    for (const method of ['select', 'eq', 'update']) {
      b[method] = jest.fn((...args: unknown[]) => {
        tableCalls.push({ fn: `${table}.${method}`, args });
        return b;
      });
    }
    b.maybeSingle = jest.fn(async () => options.tables?.[table] ?? { data: null, error: null });
    b.then = (ok: (r: unknown) => unknown) =>
      Promise.resolve(options.tables?.[table] ?? { data: null, error: null }).then(ok);
    return b;
  });
  const config = {
    get: (key: string) => (key === 'HEALTH_DATA_ENABLED' ? (options.enabled ?? true) : undefined),
  } as unknown as ConfigService;
  const service = new HealthDataService(
    { getClient: () => ({ rpc, from }) } as unknown as SupabaseService,
    config as never,
  );
  return { service, calls, tableCalls };
}

const saved: Result = { data: [{ run_id: 'run-1', rows_upserted: 2 }], error: null };

describe('HealthDataService', () => {
  it('collects nothing until health data is switched on -- Phase 3 and its Privacy Policy', async () => {
    const { service, calls } = setup({ enabled: false });
    await expect(service.importAppleHealth(ME, { trigger: 'connect' })).rejects.toMatchObject({
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });
    await expect(
      service.logManualSleep(ME, {
        startedAt: '2026-11-26T23:00:00Z',
        endedAt: '2026-11-27T06:00:00Z',
      }),
    ).rejects.toMatchObject({ status: HttpStatus.SERVICE_UNAVAILABLE });
    expect(calls).toEqual([]);
  });

  it('still deletes it when switched off', async () => {
    const { service, calls } = setup({
      enabled: false,
      rpc: { delete_health_data: { data: 12, error: null } },
    });
    await expect(service.deleteHealthData(ME, {})).resolves.toEqual({ deleted: 12 });
    expect(calls).toEqual([{ fn: 'delete_health_data', args: { p_user: ME, p_provider: null } }]);
  });

  it('saves a sync whole, in canonical units, and says what it refused', async () => {
    const { service, calls } = setup({
      rpc: { import_health_data: saved },
      tables: { users: { data: { time_zone: 'America/Vancouver' }, error: null } },
    });
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const result = await service.importAppleHealth(ME, {
      trigger: 'app_open',
      values: [
        { day: today, metric: 'distance_m', value: 6.1, unit: 'km' },
        { day: today, metric: 'resting_hr_bpm', value: 400 },
      ],
      devices: ['iPhone'],
    });
    expect(result).toEqual({
      runId: 'run-1',
      upserted: 2,
      refused: [{ kind: 'value', index: 1, reason: 'resting_hr_bpm of 400 is outside 20 to 200' }],
    });
    expect(calls[0]).toEqual({
      fn: 'import_health_data',
      args: expect.objectContaining({
        p_user: ME,
        p_provider: 'apple_health',
        p_trigger: 'app_open',
        p_metrics: [expect.objectContaining({ metric: 'distance_m', value: 6100 })],
        p_devices: ['iPhone'],
        p_granted: null,
      }),
    });
  });

  it('says to wait when syncing too often, without marking the connection', async () => {
    const { service, calls } = setup({
      rpc: { import_health_data: { data: null, error: { message: 'health_import_rate_limited' } } },
    });
    await expect(service.importAppleHealth(ME, { trigger: 'app_open' })).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
    expect(calls.map((c) => c.fn)).toEqual(['import_health_data']);
  });

  it('records a failed sync on the connection', async () => {
    const { service, calls } = setup({
      rpc: { import_health_data: { data: null, error: { message: 'boom' } } },
    });
    await expect(service.importAppleHealth(ME, { trigger: 'app_open' })).rejects.toMatchObject({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    });
    expect(calls[1]).toEqual({
      fn: 'record_health_sync_failure',
      args: {
        p_user: ME,
        p_provider: 'apple_health',
        p_trigger: 'app_open',
        p_error: 'Could not save this sync',
      },
    });
  });

  it('logs a sleep by hand, on the morning it ended, asleep the whole time unless told', async () => {
    const { service, calls } = setup({
      rpc: { import_health_data: saved },
      tables: { users: { data: { time_zone: 'UTC' }, error: null } },
    });
    const ended = new Date();
    const started = new Date(ended.getTime() - 7 * 3600_000);
    const logged = await service.logManualSleep(ME, {
      startedAt: started.toISOString(),
      endedAt: ended.toISOString(),
    });
    expect(logged.sourceRef).toMatch(/^manual-[0-9a-f-]{36}$/);
    expect(logged.day).toBe(ended.toISOString().slice(0, 10));
    expect(calls[0]?.args).toEqual(
      expect.objectContaining({
        p_provider: 'manual',
        p_trigger: 'manual',
        p_sleep: [expect.objectContaining({ in_bed_s: 25200, asleep_s: 25200, is_nap: false })],
      }),
    );
  });

  it('refuses a hand-logged sleep that ends before it starts', async () => {
    const { service, calls } = setup({ rpc: { import_health_data: saved } });
    await expect(
      service.logManualSleep(ME, {
        startedAt: '2026-11-27T06:00:00Z',
        endedAt: '2026-11-26T23:00:00Z',
      }),
    ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    expect(calls).toEqual([]);
  });

  it('deletes only their own hand-logged sleep', async () => {
    const ref = 'manual-0f8fad5b-d9cb-469f-a165-70867728950e';
    const mine = setup({
      rpc: { import_health_data: saved },
      tables: { health_sleep_sessions: { data: { id: 's1' }, error: null } },
    });
    await mine.service.deleteManualSleep(ME, ref);
    expect(mine.calls[0]?.args).toEqual(
      expect.objectContaining({ p_provider: 'manual', p_cleared_sleep: [ref] }),
    );

    const notMine = setup({ tables: { health_sleep_sessions: { data: null, error: null } } });
    await expect(notMine.service.deleteManualSleep(ME, ref)).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
    });
    await expect(notMine.service.deleteManualSleep(ME, 'night-1')).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
    });
    expect(notMine.calls).toEqual([]);
  });

  it('records a sync HealthKit woke it for as a background one', async () => {
    const { service, calls } = setup({ rpc: { import_health_data: saved } });
    await service.importAppleHealth(ME, { trigger: 'background' });
    expect(calls.find((c) => c.fn === 'import_health_data')?.args).toEqual(
      expect.objectContaining({ p_trigger: 'background' }),
    );
  });

  it('disconnects Apple Health keeping its history -- and works with health data switched off', async () => {
    const { service, calls, tableCalls } = setup({ enabled: false });
    await expect(service.disconnectAppleHealth(ME, {})).resolves.toEqual({
      disconnected: true,
      deleted: 0,
    });
    expect(calls).toEqual([]);
    expect(tableCalls).toEqual([
      { fn: 'health_connections.update', args: [{ status: 'disconnected', last_error: null }] },
      { fn: 'health_connections.eq', args: ['user_id', ME] },
      { fn: 'health_connections.eq', args: ['provider', 'apple_health'] },
    ]);
  });

  it('disconnects Apple Health and deletes its history when asked', async () => {
    const { service, calls } = setup({ rpc: { delete_health_data: { data: 40, error: null } } });
    await expect(service.disconnectAppleHealth(ME, { deleteHistory: true })).resolves.toEqual({
      disconnected: true,
      deleted: 40,
    });
    expect(calls).toEqual([
      { fn: 'delete_health_data', args: { p_user: ME, p_provider: 'apple_health' } },
    ]);
  });

  it('deletes one source’s history when asked for one', async () => {
    const { service, calls } = setup({ rpc: { delete_health_data: { data: 3, error: null } } });
    await service.deleteHealthData(ME, { source: 'oura' });
    expect(calls[0]?.args).toEqual({ p_user: ME, p_provider: 'oura' });
  });
});
