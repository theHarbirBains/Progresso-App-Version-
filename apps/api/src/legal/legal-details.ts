// The details only the owner of Progresso can supply. Until they're filled in, the pages show
// these bracketed prompts, so a missing detail is obvious rather than invented. Fill in all
// three before linking the pages from App Store Connect or inviting external testers.
export const LEGAL_DETAILS = {
  /** Who runs Progresso: your full name, or your business's legal name. */
  operator: '[your name or business name]',
  /** Where people write about privacy, their data or these terms. */
  contactEmail: '[contact email]',
  /** The law that governs the terms, e.g. "the Province of Ontario and the federal laws of Canada". */
  governingLaw: '[the province or state, and country, whose laws apply]',
  /** When the text last changed. */
  lastUpdated: 'October 18, 2026',
} as const;
