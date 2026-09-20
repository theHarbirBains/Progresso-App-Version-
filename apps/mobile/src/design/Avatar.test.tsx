import { fireEvent, render, screen } from '@testing-library/react-native';
import { Avatar } from './Avatar';

const baseProps = {
  initial: null,
  size: 72,
  iconSize: 32,
  iconColor: '#29E3C7',
  testID: 'avatar',
};

describe('Avatar', () => {
  it('renders the picture when a uri is given', () => {
    render(<Avatar {...baseProps} uri="https://example.test/a.jpg" />);

    const image = screen.getByTestId('avatar');
    expect(image.props.source).toEqual({ uri: 'https://example.test/a.jpg' });
    expect(image.props.style).toEqual({ width: 72, height: 72, borderRadius: 36 });
  });

  it('shows the initial letter when there is no picture', () => {
    render(<Avatar {...baseProps} uri={null} initial="H" />);

    expect(screen.getByTestId('avatar')).toHaveTextContent('H');
  });

  it('shows the person icon (not an initial or an image) when there is no picture and no initial', () => {
    render(<Avatar {...baseProps} uri={null} initial={null} />);

    const icon = screen.getByTestId('avatar');
    expect(icon.props.source).toBeUndefined();
    expect(screen.queryByText(/[a-zA-Z]/)).toBeNull();
  });

  it('falls back to the initial/icon when the image fails to load (missing/deleted file)', () => {
    render(<Avatar {...baseProps} uri="https://example.test/gone.jpg" initial="H" />);

    fireEvent(screen.getByTestId('avatar'), 'error');

    expect(screen.getByTestId('avatar')).toHaveTextContent('H');
  });

  it('resets the failed state when the uri changes (e.g. after uploading a new picture)', () => {
    const { rerender } = render(
      <Avatar {...baseProps} uri="https://example.test/old.jpg" initial="H" />,
    );

    fireEvent(screen.getByTestId('avatar'), 'error');
    expect(screen.getByTestId('avatar')).toHaveTextContent('H');

    rerender(<Avatar {...baseProps} uri="https://example.test/new.jpg" initial="H" />);

    expect(screen.getByTestId('avatar').props.source).toEqual({
      uri: 'https://example.test/new.jpg',
    });
  });
});
