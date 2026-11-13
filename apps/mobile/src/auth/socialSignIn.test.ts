import { socialSignInEnabled } from './socialSignIn';

it('offers email only for now -- no Google or Apple', () => {
  expect(socialSignInEnabled()).toBe(false);
});
