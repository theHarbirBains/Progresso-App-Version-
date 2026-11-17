import { render, screen } from '@testing-library/react-native';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { RankLadder } from './RankLadder';

const hidden = { includeHiddenElements: true };

describe('RankLadder', () => {
  it('lays out all nine ranks from Bronze, where you start, to Legacy, each from its AP', () => {
    render(<RankLadder testID="ladder" />);

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
    for (const id of ids) expect(screen.getByTestId(`ladder-${id}`, hidden)).toBeTruthy();
    expect(screen.getByTestId('ladder-bronze', hidden)).toHaveTextContent(
      /Bronze\s*You start here\s*0 AP/,
    );
    expect(screen.getByTestId('ladder-silver', hidden)).toHaveTextContent(/Silver\s*750 AP/);
    expect(screen.getByTestId('ladder-legacy', hidden)).toHaveTextContent(/Legacy\s*30,000 AP/);
  });

  it('reads as one line to VoiceOver, lowest first', () => {
    render(<RankLadder testID="ladder" />);

    const label = screen.getByTestId('ladder').props.accessibilityLabel as string;
    expect(label).toMatch(
      /^The nine ranks, from where you start: Bronze, from 0 AP; Silver, from 750 AP;/,
    );
    expect(label).toMatch(/Legacy, from 30,000 AP\.$/);
  });

  it('puts all its text inside Text', () => {
    render(<RankLadder testID="ladder" />);
    expectNoBareText();
  });
});
