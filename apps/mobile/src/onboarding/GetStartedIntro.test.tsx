import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { GetStartedIntro, INTRO_HOLD_MS } from './GetStartedIntro';

// The theme provider reads the profile's country (for the seasons); before sign-in there's none.
jest.mock('../profile/ProfileProvider', () => ({ useProfile: () => ({ profile: null }) }));

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('GetStartedIntro', () => {
  it("says let's get you started, then opens onto the first question by itself", () => {
    const onReveal = jest.fn();
    const onFinish = jest.fn();
    render(<GetStartedIntro returning={false} onReveal={onReveal} onFinish={onFinish} />);

    const intro = screen.getByTestId('onboarding-intro-screen');
    expect(intro).toHaveTextContent(/Let's get you\s*started!/);
    expect(intro).toHaveTextContent(/A few quick questions/);
    expect(onReveal).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(INTRO_HOLD_MS);
    });
    expect(onReveal).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('opens at once when tapped, and only once', () => {
    const onReveal = jest.fn();
    render(<GetStartedIntro returning={false} onReveal={onReveal} onFinish={jest.fn()} />);

    fireEvent.press(screen.getByRole('button'));
    expect(onReveal).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(INTRO_HOLD_MS);
    });
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it('welcomes someone back to a draft they started', () => {
    render(<GetStartedIntro returning onReveal={jest.fn()} onFinish={jest.fn()} />);

    expect(screen.getByTestId('onboarding-intro-screen')).toHaveTextContent(
      /Welcome back!\s*Let's pick up where you left off\./,
    );
  });

  it('puts all its text inside Text', () => {
    render(<GetStartedIntro returning={false} onReveal={jest.fn()} onFinish={jest.fn()} />);
    expectNoBareText();
  });
});
