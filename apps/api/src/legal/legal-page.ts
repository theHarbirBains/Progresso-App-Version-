import { LEGAL_DETAILS } from './legal-details';

/** Escapes text for HTML: the details above are plain text. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * A plain, readable page for a legal document: one column, the system font, light or dark to
 * match the device, and nothing loaded from anywhere else. `body` is trusted HTML written in
 * this folder.
 */
export function legalPage(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · Progresso</title>
<style>
  :root { color-scheme: light dark; --bg: #ffffff; --ink: #16151a; --muted: #5d5b66; --line: #e3e1e8; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #12110f; --ink: #f2f0ec; --muted: #a9a59d; --line: #2c2a26; }
  }
  body { margin: 0; background: var(--bg); color: var(--ink);
    font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 720px; margin: 0 auto; padding: 32px 20px 64px; }
  h1 { font-size: 1.9rem; line-height: 1.2; margin: 0 0 4px; }
  h2 { font-size: 1.2rem; margin: 32px 0 8px; }
  p, li { color: var(--ink); }
  .updated { color: var(--muted); margin: 0 0 24px; }
  ul { padding-left: 1.2rem; }
  li + li { margin-top: 6px; }
  a { color: inherit; }
  footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid var(--line); color: var(--muted); font-size: 0.9rem; }
</style>
</head>
<body>
<main>
<h1>${escapeHtml(title)}</h1>
<p class="updated">Last updated ${escapeHtml(LEGAL_DETAILS.lastUpdated)}</p>
${body}
<footer>Progresso is operated by ${escapeHtml(LEGAL_DETAILS.operator)}. Questions: ${escapeHtml(LEGAL_DETAILS.contactEmail)}</footer>
</main>
</body>
</html>`;
}
