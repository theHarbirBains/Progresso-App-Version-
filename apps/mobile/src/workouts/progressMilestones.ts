import { fromKg, roundWeight } from '../lib/units';
import type { DetailedChartPoint } from './exerciseProgress';

// Pure derivation over an already-fetched progression series -- no new data
// source, no invented achievements. Only two kinds of milestone are
// produced, both directly and reliably computable from real history:
// - the first ever recorded point ("First recorded")
// - each round increment of improvement over the starting point, in the
//   user's own display unit (e.g. "+10 lb", "+20 lb"), the exact examples
//   named in the product spec. Absolute round-number thresholds (a flat
//   "100 lb"/"200 lb milestone") were deliberately left out: they'd need to
//   be meaningful in an arbitrary unit for an arbitrary exercise, which
//   isn't reliably derivable the same way a *relative* improvement is.
export interface Milestone {
  kind: 'first' | 'improvement';
  label: string;
  achievedAt: string;
  displayWeight: number;
}

const IMPROVEMENT_STEP = 10;

export function deriveMilestones(
  points: DetailedChartPoint[],
  weightUnit: 'kg' | 'lb',
): Milestone[] {
  if (points.length === 0) return [];

  const displayWeights = points.map((p) => roundWeight(fromKg(p.weightKg, weightUnit)));
  const milestones: Milestone[] = [
    {
      kind: 'first',
      label: `First recorded: ${displayWeights[0]}${weightUnit} × ${points[0].reps}`,
      achievedAt: points[0].performedAt,
      displayWeight: displayWeights[0],
    },
  ];

  const startWeight = displayWeights[0];
  let nextStep = IMPROVEMENT_STEP;
  for (let i = 1; i < points.length; i++) {
    const improvement = displayWeights[i] - startWeight;
    while (improvement >= nextStep) {
      milestones.push({
        kind: 'improvement',
        label: `+${nextStep}${weightUnit} improvement`,
        achievedAt: points[i].performedAt,
        displayWeight: displayWeights[i],
      });
      nextStep += IMPROVEMENT_STEP;
    }
  }

  return milestones;
}
