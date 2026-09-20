import { render } from '@testing-library/react-native';
import { BackgroundThemePreview } from './BackgroundThemePreview';
import { BACKGROUND_THEME_ORDER, BACKGROUND_THEMES } from './backgroundThemes';

describe('BackgroundThemePreview', () => {
  it.each(BACKGROUND_THEME_ORDER)('renders a static preview for %s without crashing', (id) => {
    expect(() => render(<BackgroundThemePreview theme={BACKGROUND_THEMES[id]} />)).not.toThrow();
  });
});
