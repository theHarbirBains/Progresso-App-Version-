// The app's config is app.json; this adjusts it for one kind of build only.
//
// Apple Health sync (Phase 3 of the Health & Wearables brief) is in development builds only for
// now (src/health/sync/appleHealthSyncAvailability.ts -- Harbir's call, 2026-11-27): only an EAS
// development build gets its permission wording and HealthKit's background delivery. Preview,
// TestFlight and App Store builds keep app.json's steps-only wording and no background delivery,
// exactly as before. Switching sync on for everyone moves these into app.json.

const HEALTHKIT = '@kingstinct/react-native-healthkit';

const APPLE_HEALTH_SYNC = {
  NSHealthShareUsageDescription:
    'Progresso reads your step count to show your steps. If you connect Apple Health in Health, it also reads the sleep, heart, breathing and activity data you allow and keeps it in your Progresso account, where only you see it and can delete it. It never writes to Apple Health.',
  NSHealthUpdateUsageDescription: "Progresso doesn't save anything to Apple Health.",
  background: true,
};

module.exports = ({ config }) => {
  if (process.env.EAS_BUILD_PROFILE !== 'development') return config;
  return {
    ...config,
    plugins: (config.plugins ?? []).map((plugin) =>
      Array.isArray(plugin) && plugin[0] === HEALTHKIT
        ? [HEALTHKIT, { ...plugin[1], ...APPLE_HEALTH_SYNC }]
        : plugin,
    ),
  };
};
