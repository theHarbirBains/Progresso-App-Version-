import { render, screen } from '@testing-library/react-native';
import { AchievementsContext, type AchievementsValue } from '../achievements/achievementsContext';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { RankProgressionScreen } from './RankProgressionScreen';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { goBack: jest.fn(), navigate: jest.fn() };

function renderScreen(params?: { points?: number; name?: string }, points = 2_250) {
  const value = { points } as AchievementsValue;
  return render(
    <AchievementsContext.Provider value={value}>
      <RankProgressionScreen navigation={navigation} route={{ params } as never} />
    </AchievementsContext.Provider>,
  );
}

describe('RankProgressionScreen', () => {
  it('lists all nine ranks in order, each with its AP range and five divisions, V to I', () => {
    renderScreen();

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
    for (const id of ids) expect(screen.getByTestId(`rank-tier-${id}`)).toBeTruthy();
    expect(screen.getByTestId('rank-tier-gold')).toHaveTextContent(/Gold.*1,500–2,999 AP/);
    expect(screen.getByTestId('rank-tier-legacy')).toHaveTextContent(
      /23,000\+ AP.*every 2,000 AP is another Legacy level/,
    );
    expect(screen.getByTestId('rank-silver-V').props.accessibilityLabel).toBe(
      'Silver V: from 500 AP, reached',
    );
    expect(screen.getByTestId('rank-gold-III').props.accessibilityLabel).toBe(
      'Gold III: from 2,100 AP, current',
    );
    expect(screen.getByTestId('rank-gold-II').props.accessibilityLabel).toBe(
      'Gold II: from 2,400 AP',
    );
    expectNoBareText();
  });

  it('marks where you are', () => {
    renderScreen();
    expect(screen.getByTestId('rank-tier-gold')).toHaveTextContent(/You're here/);
    expect(screen.queryByText(/is here/)).toBeNull();
  });

  it("shows someone else's place when opened from their profile", () => {
    renderScreen({ points: 9_000, name: 'Sam' });

    expect(screen.getByTestId('rank-tier-vanguard')).toHaveTextContent(/Sam is here/);
    expect(screen.getByTestId('rank-intro')).toHaveTextContent(/Sam is Vanguard IV with 9,000 AP/);
  });
});
