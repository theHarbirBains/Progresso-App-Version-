import { privacyPolicyHtml } from './privacy-policy';

describe('the Privacy Policy’s Apple Health wording', () => {
  it('says steps never leave the phone while no health data is kept', () => {
    const page = privacyPolicyHtml(false);
    expect(page).toContain("Your steps are read on your phone each time they're shown");
    expect(page).not.toContain('keeps them in your Progresso account');
    expect(page).toContain('Last updated November 26, 2026');
  });

  it('says what is read and kept, and who sees it, once health data is kept', () => {
    const page = privacyPolicyHtml(true);
    expect(page).toContain('keeps them in your Progresso account');
    expect(page).toContain('Only you can see them: not your trainer');
    expect(page).toContain('from the last 90 days');
    expect(page).toContain('including in the background');
    expect(page).toContain('Progresso never writes to Apple Health');
    expect(page).toContain(
      'Disconnect Apple Health, and delete the health data kept in your account',
    );
    expect(page).not.toContain('never leave it');
    expect(page).toContain('Last updated November 27, 2026');
  });
});
