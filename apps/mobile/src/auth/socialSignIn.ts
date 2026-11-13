// Whether Sign In and onboarding's Create Account offer Google and Apple beside email. Off for
// now, by request: email sign-up and sign-in only. Their code stays, so turning this back on
// is all it takes -- tests that cover them turn it on.
export function socialSignInEnabled(): boolean {
  return false;
}
