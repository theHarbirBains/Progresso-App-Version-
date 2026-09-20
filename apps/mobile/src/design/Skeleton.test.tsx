import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import * as navigationTransitions from '../navigation/navigationTransitions';
import { Skeleton, SkeletonRows } from './Skeleton';
import { colors, radii } from './theme';

describe('Skeleton', () => {
  beforeEach(() => {
    jest.spyOn(navigationTransitions, 'useReduceMotionPreference').mockReturnValue(false);
  });
  afterEach(() => jest.restoreAllMocks());

  it('renders a block of the requested size, on the raised surface colour', () => {
    render(<Skeleton testID="sk" width={120} height={20} />);

    const style = StyleSheet.flatten(screen.getByTestId('sk').props.style);
    expect(style.width).toBe(120);
    expect(style.height).toBe(20);
    expect(style.backgroundColor).toBe(colors.surfaceRaised);
    expect(style.borderRadius).toBe(radii.sm);
  });

  it('still renders (as a static block) when Reduce Motion is on', () => {
    jest.spyOn(navigationTransitions, 'useReduceMotionPreference').mockReturnValue(true);

    render(<Skeleton testID="sk" />);

    expect(screen.getByTestId('sk')).toBeTruthy();
  });
});

describe('SkeletonRows', () => {
  beforeEach(() => {
    jest.spyOn(navigationTransitions, 'useReduceMotionPreference').mockReturnValue(false);
  });
  afterEach(() => jest.restoreAllMocks());

  it('announces one "Loading" state for the whole placeholder, not one per block', () => {
    render(<SkeletonRows testID="rows" />);

    const rows = screen.getByTestId('rows');
    expect(rows.props.accessible).toBe(true);
    expect(rows.props.accessibilityRole).toBe('progressbar');
    expect(rows.props.accessibilityLabel).toBe('Loading');
  });

  it('renders the requested number of rows', () => {
    render(<SkeletonRows testID="rows" count={3} />);

    // Each row is an icon well plus two text lines = 3 blocks.
    expect(screen.getByTestId('rows').children).toHaveLength(3);
  });
});
