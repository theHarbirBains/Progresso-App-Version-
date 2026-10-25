import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { fetchMyRole } from '../lib/feedbackApi';

// Whether the signed-in person is a support or full admin (admin_users, through GET /users/me),
// asked once per person per session -- only to decide whether the app offers the Feedback Inbox.
// The API enforces it on every inbox request whatever the app shows.
const known = new Map<string, boolean>();

/** For tests: forget what's been learned. */
export function forgetAdminRoles(): void {
  known.clear();
}

export function useIsAdmin(): boolean {
  const { user, session } = useAuth();
  const userId = user?.id;
  const accessToken = session?.access_token;
  const [isAdmin, setIsAdmin] = useState(() => (userId ? (known.get(userId) ?? false) : false));

  useEffect(() => {
    if (!userId || !accessToken) {
      setIsAdmin(false);
      return;
    }
    const cached = known.get(userId);
    if (cached !== undefined) {
      setIsAdmin(cached);
      return;
    }
    let cancelled = false;
    fetchMyRole(accessToken)
      .then((role) => {
        const admin = role === 'support_admin' || role === 'full_admin';
        known.set(userId, admin);
        if (!cancelled) setIsAdmin(admin);
      })
      // Not knowing means not offering it; it's asked again next time.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [userId, accessToken]);

  return isAdmin;
}
