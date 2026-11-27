/**
 * Apple Health sync (Phase 3 of the Health & Wearables brief): built in full, and for now only in
 * development builds (Harbir's call, 2026-11-27) -- TestFlight and the App Store keep reading steps
 * on the phone only. Turning it on for everyone also needs the server's HEALTH_DATA_ENABLED (which
 * switches the published Privacy Policy's wording with it) and the App Store privacy labels.
 */
export const APPLE_HEALTH_SYNC_ENABLED: boolean = __DEV__;
