import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ProgressHeader } from './ProgressHeader';

describe('ProgressHeader', () => {
  it('renders the eyebrow, heading, and supporting text', () => {
    render(
      <ProgressHeader
        onOpenMenu={jest.fn()}
        accentColor="#2F80FF"
        modeToggle={<Text>toggle</Text>}
      />,
    );

    expect(screen.getByText('PROGRESS')).toBeTruthy();
    expect(screen.getByText('Track Your Growth')).toBeTruthy();
    expect(screen.getByTestId('progress-header-subtitle')).toHaveTextContent(
      /Consistency today\..*A stronger tomorrow\./s,
    );
  });

  it('calls onOpenMenu when the hamburger is pressed', () => {
    const onOpenMenu = jest.fn();
    render(
      <ProgressHeader
        onOpenMenu={onOpenMenu}
        accentColor="#2F80FF"
        modeToggle={<Text>toggle</Text>}
      />,
    );

    fireEvent.press(screen.getByTestId('progress-open-menu'));

    expect(onOpenMenu).toHaveBeenCalled();
  });

  it('renders the given modeToggle between the chrome row and the heading', () => {
    render(
      <ProgressHeader
        onOpenMenu={jest.fn()}
        accentColor="#2F80FF"
        modeToggle={<Text testID="fake-toggle">toggle</Text>}
      />,
    );

    expect(screen.getByTestId('fake-toggle')).toBeTruthy();
  });

  it('shows a centered "Progress" title on the chrome row', () => {
    render(
      <ProgressHeader
        onOpenMenu={jest.fn()}
        accentColor="#2F80FF"
        modeToggle={<Text>toggle</Text>}
      />,
    );

    expect(screen.getByText('Progress')).toBeTruthy();
  });

  it('hides the eyebrow/heading/supporting text when showHeading is false, but keeps the title and toggle', () => {
    render(
      <ProgressHeader
        onOpenMenu={jest.fn()}
        accentColor="#2F80FF"
        modeToggle={<Text testID="fake-toggle">toggle</Text>}
        showHeading={false}
      />,
    );

    expect(screen.getByText('Progress')).toBeTruthy();
    expect(screen.getByTestId('fake-toggle')).toBeTruthy();
    expect(screen.queryByText('PROGRESS')).toBeNull();
    expect(screen.queryByText('Track Your Growth')).toBeNull();
    expect(screen.queryByTestId('progress-header-subtitle')).toBeNull();
  });
});
