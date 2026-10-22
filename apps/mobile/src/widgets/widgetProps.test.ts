import {
  nextMidnight,
  nutritionTimeline,
  nutritionWidgetProps,
  stepsTimeline,
} from './widgetProps';

const TARGETS = { calories: 2000, proteinG: 150, carbsG: 220, fatG: 60 };

describe('nutritionWidgetProps', () => {
  it('gives the calories left, and each macro against its target', () => {
    expect(
      nutritionWidgetProps({ calories: 760.4, proteinG: 92.3, carbsG: 80, fatG: 21.6 }, TARGETS),
    ).toEqual({
      signedIn: true,
      calories: '1,240',
      caption: 'cal left',
      progress: 0.3802,
      macros: [
        { label: 'Protein', amount: '92 / 150 g', progress: 92.3 / 150 },
        { label: 'Carbs', amount: '80 / 220 g', progress: 80 / 220 },
        { label: 'Fat', amount: '22 / 60 g', progress: 21.6 / 60 },
      ],
    });
  });

  it('says how far over, with the bars full', () => {
    const props = nutritionWidgetProps(
      { calories: 2150, proteinG: 160, carbsG: 0, fatG: 0 },
      TARGETS,
    );
    expect(props).toMatchObject({ calories: '150', caption: 'cal over', progress: 1 });
    expect(props.macros[0].progress).toBe(1);
  });

  it('shows what was eaten, with no bars, when no targets are set', () => {
    const props = nutritionWidgetProps(
      { calories: 500, proteinG: 30, carbsG: 50, fatG: 10 },
      { calories: null, proteinG: null, carbsG: null, fatG: null },
    );
    expect(props).toMatchObject({ calories: '500', caption: 'cal eaten', progress: null });
    expect(props.macros[0]).toEqual({ label: 'Protein', amount: '30 g', progress: null });
  });
});

describe('the timelines', () => {
  const now = new Date(2026, 9, 22, 15, 42);

  it('turn over to a fresh day at midnight', () => {
    expect(nextMidnight(now)).toEqual(new Date(2026, 9, 23));
    expect(nextMidnight(new Date(2026, 11, 31, 23, 59))).toEqual(new Date(2027, 0, 1));
  });

  it("start Today's Nutrition again at midnight with nothing eaten and the targets kept", () => {
    const [today, tomorrow] = nutritionTimeline(
      { calories: 760, proteinG: 92, carbsG: 80, fatG: 21 },
      TARGETS,
      now,
    );
    expect(today).toMatchObject({ date: now, props: { calories: '1,240' } });
    expect(tomorrow).toMatchObject({
      date: new Date(2026, 9, 23),
      props: { calories: '2,000', caption: 'cal left', progress: 0 },
    });
  });

  it("show today's steps until midnight, then ask for the app to update them", () => {
    const [today, tomorrow] = stepsTimeline(8412, now);
    expect(today.props).toEqual({
      signedIn: true,
      steps: '8,412',
      caption: expect.stringMatching(/^As of 3:42/),
    });
    expect(tomorrow).toEqual({
      date: new Date(2026, 9, 23),
      props: { signedIn: true, steps: null, caption: 'Open Progresso to update' },
    });
  });

  it('ask to connect Apple Health when steps are not read yet', () => {
    expect(stepsTimeline(null, now)[0].props).toEqual({
      signedIn: true,
      steps: null,
      caption: 'Connect Apple Health in Progresso',
    });
  });
});
