import { fireEvent, render, screen } from '@testing-library/react-native';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders its title', () => {
    render(<EmptyState testID="empty" title="Start your first workout" />);

    expect(screen.getByTestId('empty')).toHaveTextContent('Start your first workout');
  });
});

describe('EmptyState description and action', () => {
  it('renders an optional supporting sentence', () => {
    render(<EmptyState title="No meals yet" description="Log food to see it here." />);

    expect(screen.getByText('Log food to see it here.')).toBeTruthy();
  });

  it('renders no button unless an action is given', () => {
    render(<EmptyState title="No meals yet" />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders one next-step button that calls back', () => {
    const onPress = jest.fn();
    render(
      <EmptyState
        title="No meals yet"
        action={{ label: 'Log food', onPress, testID: 'empty-action' }}
      />,
    );

    fireEvent.press(screen.getByTestId('empty-action'));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Log food')).toBeTruthy();
  });
});
