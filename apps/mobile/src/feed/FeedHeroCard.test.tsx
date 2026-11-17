import { render, screen } from '@testing-library/react-native';
import { Decorated } from '../testUtils/decorated';
import { FeedHeroCard } from './FeedHeroCard';
import { FeedGreeting } from './FeedGreeting';

const hidden = { includeHiddenElements: true };

function hero() {
  return (
    <FeedHeroCard
      testID="hero"
      eyebrow="Next Workout"
      title="Push"
      meta="Let's get started"
      actionLabel="Start Workout"
      onPress={jest.fn()}
      accessibilityLabel="Next workout: Push"
    />
  );
}

describe('the holidays on Feed', () => {
  it('lays snow along the hero card, with Holiday Decorations on -- and none otherwise', () => {
    const { unmount } = render(<Decorated>{hero()}</Decorated>);
    expect(screen.getByTestId('hero-snow', hidden)).toBeTruthy();
    unmount();

    render(hero());
    expect(screen.queryByTestId('hero-snow', hidden)).toBeNull();
  });

  it('greets festively, with a small star, with Holiday Decorations on', () => {
    const christmas = new Date(2026, 11, 25, 9);
    const { unmount } = render(
      <Decorated>
        <FeedGreeting displayName="Harbir Bains" now={christmas} />
      </Decorated>,
    );
    expect(screen.getByTestId('feed-greeting-headline')).toHaveTextContent(
      'Merry Christmas, Harbir',
    );
    expect(screen.getByTestId('feed-greeting-star', hidden)).toBeTruthy();
    unmount();

    render(<FeedGreeting displayName="Harbir Bains" now={christmas} />);
    expect(screen.queryByTestId('feed-greeting-star', hidden)).toBeNull();
  });
});
