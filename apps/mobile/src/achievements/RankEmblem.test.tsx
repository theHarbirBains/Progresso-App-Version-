import { render, screen } from '@testing-library/react-native';
import { TIERS } from './ranks';
import { RankEmblem } from './RankEmblem';

describe('RankEmblem', () => {
  it("draws every tier's emblem with its division's numeral", () => {
    TIERS.forEach((tier, index) => {
      const view = render(
        <RankEmblem tierIndex={index} divisionIndex={2} testID={`emblem-${tier.id}`} />,
      );
      expect(
        screen.getByTestId(`emblem-${tier.id}`, { includeHiddenElements: true }),
      ).toHaveTextContent('III');
      view.unmount();
    });
  });

  it('can leave the numeral out, and is hidden from assistive tech (its caller says the rank)', () => {
    render(<RankEmblem tierIndex={0} divisionIndex={0} showDivision={false} testID="emblem" />);
    expect(screen.getByTestId('emblem', { includeHiddenElements: true })).not.toHaveTextContent(
      'V',
    );
    expect(
      screen.getByTestId('emblem', { includeHiddenElements: true }).props
        .accessibilityElementsHidden,
    ).toBe(true);
  });
});
