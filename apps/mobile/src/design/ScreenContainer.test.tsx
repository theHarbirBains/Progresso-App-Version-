import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { ScreenContainer } from './ScreenContainer';

describe('ScreenContainer', () => {
  it('renders its children inside a scrollable container by default', () => {
    render(
      <ScreenContainer testID="screen">
        <Text>Hello</Text>
      </ScreenContainer>,
    );

    expect(screen.getByTestId('screen')).toBeTruthy();
    expect(screen.getByText('Hello')).toBeTruthy();
  });

  it('renders a plain (non-scrolling) container when scroll is false', () => {
    render(
      <ScreenContainer testID="screen" scroll={false}>
        <Text>Loading</Text>
      </ScreenContainer>,
    );

    expect(screen.getByTestId('screen')).toBeTruthy();
    expect(screen.getByText('Loading')).toBeTruthy();
  });
});
