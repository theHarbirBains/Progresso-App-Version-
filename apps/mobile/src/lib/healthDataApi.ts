import { request } from './apiClient';

// Health data's writes go through the API (apps/api/src/health-data), which checks every value and
// saves a sync whole; reading is straight from Supabase under RLS. Phase 3 of the Health &
// Wearables brief: Apple Health, from a development build only for now.

export type AppleHealthTrigger = 'connect' | 'app_open' | 'background' | 'manual' | 'backfill';

export interface AppleHealthImport {
  trigger: AppleHealthTrigger;
  values: { day: string; metric: string; value: number; unit: string }[];
  cleared: { day: string; metric: string }[];
  sleep: {
    sourceRef: string;
    startedAt: string;
    endedAt: string;
    inBedS?: number;
    asleepS?: number;
    awakeS?: number;
    remS?: number;
    lightS?: number;
    deepS?: number;
    device?: string;
  }[];
  clearedSleep: string[];
  devices: string[];
}

export interface AppleHealthImportResult {
  runId: string;
  upserted: number;
  refused: { kind: 'value' | 'cleared' | 'sleep'; index: number; reason: string }[];
}

/** 90 days of everything is a big sync: the server gets longer than usual to save it. */
const IMPORT_TIMEOUT_MS = 45_000;

export function importAppleHealth(
  accessToken: string,
  sync: AppleHealthImport,
): Promise<AppleHealthImportResult> {
  return request<AppleHealthImportResult>(
    '/api/v1/health-data/apple/import',
    accessToken,
    { method: 'POST', body: JSON.stringify(sync) },
    { timeoutMs: IMPORT_TIMEOUT_MS },
  );
}

/** Stops Apple Health syncing: its history kept, or deleted with it. */
export function disconnectAppleHealth(
  accessToken: string,
  deleteHistory: boolean,
): Promise<{ disconnected: true; deleted: number }> {
  return request<{ disconnected: true; deleted: number }>(
    '/api/v1/health-data/apple/disconnect',
    accessToken,
    { method: 'POST', body: JSON.stringify({ deleteHistory }) },
  );
}
