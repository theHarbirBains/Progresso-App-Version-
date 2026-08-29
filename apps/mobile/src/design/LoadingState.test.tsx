import { render, screen } from '@testing-library/react-native';
import { LoadingState } from './LoadingState';

describe('LoadingState', () => {
  it('renders an activity indicator with the given testID', () => {
    render(<LoadingState testID="loading" />);

    expect(screen.getByTestId('loading')).toBeTruthy();
  });
});
