// Pure, no I/O. A short badge derived mechanically from the split's own
// real name -- e.g. "Push / Pull / Legs" -> "PPL" -- never an invented
// label. A multi-word name uses one initial per word; a single-word name
// (already short, e.g. a split literally named "PPL") is shown as-is,
// truncated only if it runs long.

export function splitBadgeText(splitName: string): string {
  const words = splitName
    .trim()
    .split(/[\s/-]+/)
    .filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) {
    return words[0].slice(0, 4).toUpperCase();
  }
  return words
    .map((word) => word[0].toUpperCase())
    .join('')
    .slice(0, 4);
}
