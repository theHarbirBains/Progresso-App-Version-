// This used to be one ~950-line file holding every backend-API domain's
// types and functions. Split by domain (profile, exercises, equipment
// profiles, foods, notifications, follows, feed, trainer, groups) into
// their own files, each sharing apiClient.ts's request()/error handling --
// easier to find and change one domain's functions without touching
// everyone else's. Re-exported here as a barrel so every existing
// `from '../lib/api'` import across the app keeps working unchanged.
export * from './profileApi';
export * from './exercisesApi';
export * from './equipmentProfilesApi';
export * from './foodsApi';
export * from './notificationsApi';
export * from './followsApi';
export * from './feedApi';
export * from './trainerApi';
export * from './groupsApi';
