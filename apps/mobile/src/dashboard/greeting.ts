// Pure, no I/O. Time-of-day banding and name resolution kept separate so
// each is independently testable without mocking a clock through a screen.

export function getGreeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Prefers displayName, then username. Never the raw email -- an unset
 * profile just gets a name-less greeting rather than an awkward
 * "Good morning, athlete@example.com".
 */
export function greetingName(
  displayName: string | null | undefined,
  username: string | null | undefined,
): string | null {
  const trimmedDisplayName = displayName?.trim();
  if (trimmedDisplayName) return trimmedDisplayName;
  const trimmedUsername = username?.trim();
  if (trimmedUsername) return trimmedUsername;
  return null;
}

/** The first word of a resolved greeting name -- "Harbir Bains" -> "Harbir". A username has no spaces, so this is a no-op for it. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0];
}
