import { randomUUID } from 'node:crypto';
import {
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation';
import { SupabaseService } from '../supabase/supabase.service';
import type {
  AppleHealthImportDto,
  DeleteHealthDataQueryDto,
  DisconnectHealthDto,
  ManualSleepDto,
} from './dto/health-import.dto';
import type { HealthProvider } from './health-metrics';
import {
  normaliseCleared,
  normaliseSleep,
  normaliseValues,
  type MetricRow,
  type Refused,
  type SleepRow,
} from './health-normalise';

export interface ImportResult {
  runId: string;
  upserted: number;
  /** What couldn't be stored, and why -- the rest of the sync was. */
  refused: Refused[];
}

type SyncTrigger =
  'connect' | 'app_open' | 'background' | 'webhook' | 'manual' | 'backfill' | 'nightly';

/** A manual sleep's handle: "manual-<uuid>". */
const MANUAL_REF = /^manual-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Health data (Phase 2 of the Health & Wearables brief): the server's one way of writing it.
 * Every value is validated and put in its canonical unit here, then the whole sync is saved in one
 * transaction by import_health_data -- a retry upserts, never duplicates. People read their own
 * straight from Supabase under RLS (health_daily); nobody else ever does.
 *
 * Nothing is collected until HEALTH_DATA_ENABLED is set, which waits for Phase 3 to ship with
 * its permission wording and the rewritten Privacy Policy. Deleting is always allowed.
 */
@Injectable()
export class HealthDataService {
  private readonly logger = new Logger(HealthDataService.name);
  private readonly enabled: boolean;

  constructor(
    private readonly supabase: SupabaseService,
    configService: ConfigService<EnvironmentVariables, true>,
  ) {
    this.enabled = configService.get('HEALTH_DATA_ENABLED', { infer: true });
  }

  private assertCollecting(): void {
    if (!this.enabled) {
      throw new ServiceUnavailableException('Health data isn’t being collected yet');
    }
  }

  /** What the app read from Apple Health: each day's values and each sleep. */
  async importAppleHealth(userId: string, dto: AppleHealthImportDto): Promise<ImportResult> {
    this.assertCollecting();
    const now = new Date();
    const timeZone = await this.timeZoneOf(userId);
    const values = normaliseValues('apple_health', dto.values ?? [], now);
    const cleared = normaliseCleared('apple_health', dto.cleared ?? [], now);
    const sleep = normaliseSleep(dto.sleep ?? [], timeZone, now);
    const result = await this.save(userId, 'apple_health', dto.trigger, {
      metrics: values.rows,
      cleared: cleared.rows,
      sleep: sleep.rows,
      clearedSleep: dto.clearedSleep ?? [],
      devices: dto.devices ?? null,
      granted: dto.granted ?? null,
    });
    return { ...result, refused: [...values.refused, ...cleared.refused, ...sleep.refused] };
  }

  /** A night (or nap) logged by hand. Returns its handle, for deleting it. */
  async logManualSleep(
    userId: string,
    dto: ManualSleepDto,
  ): Promise<{ sourceRef: string; day: string }> {
    this.assertCollecting();
    const started = new Date(dto.startedAt);
    const ended = new Date(dto.endedAt);
    const span = Math.round((ended.getTime() - started.getTime()) / 1000);
    const sourceRef = `manual-${randomUUID()}`;
    const sleep = normaliseSleep(
      [
        {
          sourceRef,
          startedAt: dto.startedAt,
          endedAt: dto.endedAt,
          inBedS: span,
          asleepS: dto.asleepMinutes === undefined ? span : dto.asleepMinutes * 60,
          isNap: dto.isNap,
        },
      ],
      await this.timeZoneOf(userId),
      new Date(),
    );
    const row = sleep.rows[0];
    if (!row) {
      throw new HttpException(
        `That sleep can’t be saved: ${sleep.refused[0]?.reason ?? 'it isn’t a sleep'}`,
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.save(userId, 'manual', 'manual', { sleep: [row] });
    return { sourceRef, day: row.day };
  }

  /** Removes a sleep they logged by hand, and its night's totals with it. */
  async deleteManualSleep(userId: string, sourceRef: string): Promise<void> {
    if (!MANUAL_REF.test(sourceRef)) throw new NotFoundException('Sleep not found');
    const { data, error } = await this.supabase
      .getClient()
      .from('health_sleep_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('source', 'manual')
      .eq('source_ref', sourceRef)
      .maybeSingle();
    if (error) throw new InternalServerErrorException('Could not delete that sleep');
    if (!data) throw new NotFoundException('Sleep not found');
    await this.save(userId, 'manual', 'manual', { clearedSleep: [sourceRef] });
  }

  /**
   * Stops Apple Health syncing: the connection is marked disconnected (Apple doesn't let an app
   * revoke its own access -- the person turns it off in the Health app), and its history is kept
   * or deleted, as they choose. Nothing syncs again until they connect.
   */
  async disconnectAppleHealth(
    userId: string,
    dto: DisconnectHealthDto,
  ): Promise<{ disconnected: true; deleted: number }> {
    if (dto.deleteHistory) {
      const { deleted } = await this.deleteHealthData(userId, { source: 'apple_health' });
      return { disconnected: true, deleted };
    }
    const { error } = await this.supabase
      .getClient()
      .from('health_connections')
      .update({ status: 'disconnected', last_error: null })
      .eq('user_id', userId)
      .eq('provider', 'apple_health');
    if (error) {
      this.logger.error(`disconnect failed: ${error.message}`);
      throw new InternalServerErrorException('Could not disconnect Apple Health');
    }
    return { disconnected: true, deleted: 0 };
  }

  /**
   * "Delete my health data": one source's history, or every health row of theirs. A provider with
   * tokens (Oura, Phase 4) is revoked and its tokens removed here first.
   */
  async deleteHealthData(
    userId: string,
    query: DeleteHealthDataQueryDto,
  ): Promise<{ deleted: number }> {
    const { data, error } = await this.supabase.getClient().rpc('delete_health_data', {
      p_user: userId,
      p_provider: query.source ?? null,
    });
    if (error) {
      this.logger.error(`delete_health_data failed: ${error.message}`);
      throw new InternalServerErrorException('Could not delete your health data');
    }
    return { deleted: Number(data ?? 0) };
  }

  private async timeZoneOf(userId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('users')
      .select('time_zone')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      // A day in UTC is still a day; never a reason to lose a sync.
      this.logger.warn(`time zone lookup failed: ${error.message}`);
      return null;
    }
    return (data?.time_zone as string | null | undefined) ?? null;
  }

  /** One sync, whole or not at all; a failure is recorded on the connection. */
  private async save(
    userId: string,
    provider: HealthProvider,
    trigger: SyncTrigger,
    sync: {
      metrics?: MetricRow[];
      cleared?: { day: string; metric: string }[];
      sleep?: SleepRow[];
      clearedSleep?: string[];
      devices?: string[] | null;
      granted?: string[] | null;
    },
  ): Promise<{ runId: string; upserted: number }> {
    const client = this.supabase.getClient();
    const { data, error } = await client.rpc('import_health_data', {
      p_user: userId,
      p_provider: provider,
      p_trigger: trigger,
      p_metrics: sync.metrics ?? [],
      p_cleared: sync.cleared ?? [],
      p_sleep: sync.sleep ?? [],
      p_cleared_sleep: sync.clearedSleep ?? [],
      p_devices: sync.devices ?? null,
      p_granted: sync.granted ?? null,
    });
    if (error) {
      if (error.message?.includes('health_import_rate_limited')) {
        throw new HttpException(
          'Too many syncs at once -- try again in a few minutes',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      this.logger.error(`import_health_data failed: ${error.message}`);
      const failure = await client.rpc('record_health_sync_failure', {
        p_user: userId,
        p_provider: provider,
        p_trigger: trigger,
        p_error: 'Could not save this sync',
      });
      if (failure.error) {
        this.logger.error(`record_health_sync_failure failed: ${failure.error.message}`);
      }
      throw new InternalServerErrorException('Could not save your health data');
    }
    const row = (Array.isArray(data) ? data[0] : data) as
      { run_id: string; rows_upserted: number } | undefined;
    if (!row) throw new InternalServerErrorException('Could not save your health data');
    return { runId: row.run_id, upserted: row.rows_upserted };
  }
}
