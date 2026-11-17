// Onboarding's Build My Own Split can't build a split there and then -- a split belongs to an
// account, and the account is made last -- so choosing it is remembered here, and the builder
// (WorkoutSplitForm) opens the moment the new account reaches the app (App.tsx, as its navigator
// is ready), after the welcome. Kept in memory only: an app closed first simply opens as usual,
// and Start Workout's "no active split" step still leads to the same builder.

let pending = false;

/** Remembers that the split builder should open once the app shows. */
export function openCustomSplitBuilderSoon(): void {
  pending = true;
}

/** Whether the builder should open now -- true once, then false. */
export function takeCustomSplitBuilder(): boolean {
  const open = pending;
  pending = false;
  return open;
}
