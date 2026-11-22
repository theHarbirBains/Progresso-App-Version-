import { fireEvent, render, screen } from '@testing-library/react-native';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { RankClimb } from './RankClimb';

const hidden = { includeHiddenElements: true };

describe('RankClimb', () => {
  it('starts everyone at Bronze V, with how far Silver is', () => {
    render(<RankClimb testID="rank" />);

    expect(screen.getByTestId('rank-start')).toHaveTextContent(
      /YOUR STARTING RANK\s*Bronze V\s*0 AP · Silver at 750 AP/,
    );
  });

  it('draws all nine ranks as a climb once it knows its width, Bronze first and Legacy last', () => {
    render(<RankClimb testID="rank" />);
    expect(screen.queryByTestId('rank-ladder-bronze', hidden)).toBeNull();

    fireEvent(screen.getByTestId('rank-ladder'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 112 } },
    });

    const ids = [
      'bronze',
      'silver',
      'gold',
      'platinum',
      'diamond',
      'vanguard',
      'titan',
      'sovereign',
      'legacy',
    ];
    const lefts = ids.map((id) => {
      const style = [screen.getByTestId(`rank-ladder-${id}`, hidden).props.style].flat();
      return Object.assign({}, ...style).left as number;
    });
    // Each further right than the last.
    expect([...lefts].sort((a, b) => a - b)).toEqual(lefts);
    expect(screen.getByTestId('rank')).toHaveTextContent(
      /Bronze\s*You start here.*Legacy\s*30,000 AP/,
    );
  });

  it('reads the climb as one line to VoiceOver, lowest first', () => {
    render(<RankClimb testID="rank" />);

    const label = screen.getByTestId('rank-ladder').props.accessibilityLabel as string;
    expect(label).toMatch(
      /^The nine ranks, from where you start: Bronze, from 0 AP; Silver, from 750 AP;/,
    );
    expect(label).toMatch(/Legacy, from 30,000 AP\.$/);
  });

  it('says how points are earned', () => {
    render(<RankClimb testID="rank" />);

    expect(screen.getByTestId('rank')).toHaveTextContent(
      /Train and log.*Earn achievements.*Climb the ranks\s*No seasons, no decay/,
    );
  });

  it('puts all its text inside Text', () => {
    render(<RankClimb testID="rank" />);
    expectNoBareText();
  });
});
