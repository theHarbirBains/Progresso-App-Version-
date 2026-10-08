import { act, renderHook } from '@testing-library/react-native';
import { useSetInputDrafts } from './useSetInputDrafts';

describe('useSetInputDrafts', () => {
  it('starts with no drafts', () => {
    const { result } = renderHook(() => useSetInputDrafts());

    expect(result.current.setInputs).toEqual({});
  });

  it('changeWeight sets the weight, keeping any existing reps for that set', () => {
    const { result } = renderHook(() => useSetInputDrafts());

    act(() => result.current.changeReps('s1', '8'));
    act(() => result.current.changeWeight('s1', '100'));

    expect(result.current.setInputs.s1).toEqual({ weight: '100', reps: '8' });
  });

  it('changeReps sets the reps, keeping any existing weight for that set', () => {
    const { result } = renderHook(() => useSetInputDrafts());

    act(() => result.current.changeWeight('s1', '100'));
    act(() => result.current.changeReps('s1', '8'));

    expect(result.current.setInputs.s1).toEqual({ weight: '100', reps: '8' });
  });

  it("never touches another set's draft", () => {
    const { result } = renderHook(() => useSetInputDrafts());

    act(() => result.current.changeWeight('s1', '100'));
    act(() => result.current.changeWeight('s2', '50'));

    expect(result.current.setInputs.s1).toEqual({ weight: '100', reps: '' });
    expect(result.current.setInputs.s2).toEqual({ weight: '50', reps: '' });
  });

  it('changeWeight/changeReps are stable across renders, so a memoised row can skip re-rendering', () => {
    const { result, rerender } = renderHook(() => useSetInputDrafts());
    const { changeWeight, changeReps } = result.current;

    rerender({});

    expect(result.current.changeWeight).toBe(changeWeight);
    expect(result.current.changeReps).toBe(changeReps);
  });

  it('exposes the raw setter for callers that need more than a single-field change', () => {
    const { result } = renderHook(() => useSetInputDrafts());

    act(() => {
      result.current.setSetInputs({ s1: { weight: '100', reps: '8' } });
    });

    expect(result.current.setInputs).toEqual({ s1: { weight: '100', reps: '8' } });

    act(() => {
      result.current.setSetInputs((prev) => {
        const next = { ...prev };
        delete next.s1;
        return next;
      });
    });

    expect(result.current.setInputs).toEqual({});
  });
});
