/** Escapes ILIKE's own wildcard characters so a literal "%"/"_" a user typed
 * (e.g. searching for "100%" or "snack_size") is matched literally instead
 * of being interpreted as a SQL pattern wildcard. Same convention as the
 * API's own escapeIlike (apps/api/src/foods/foods.service.ts). */
export function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (match) => `\\${match}`);
}
