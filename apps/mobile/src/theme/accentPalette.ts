// The complete set of preset accent colors a user can choose from for either
// Workout Mode or Nutrition Mode. Centralized here so no screen hardcodes
// its own copy -- WorkoutColorScreen and NutritionColorScreen both render
// this same list, grouped exactly as listed.
export interface AccentPresetColor {
  name: string;
  hex: string;
}

export interface AccentPresetGroup {
  label: string;
  colors: AccentPresetColor[];
}

export const ACCENT_PRESET_GROUPS: AccentPresetGroup[] = [
  {
    label: 'Blues',
    colors: [
      { name: 'Electric Blue', hex: '#2F80FF' },
      { name: 'Royal Blue', hex: '#4169E1' },
      { name: 'Cobalt', hex: '#2563EB' },
      { name: 'Sky Blue', hex: '#38BDF8' },
      { name: 'Ice Blue', hex: '#67E8F9' },
      { name: 'Deep Blue', hex: '#1D4ED8' },
      { name: 'Steel Blue', hex: '#4F7CAC' },
      { name: 'Midnight Blue', hex: '#3B5CCC' },
    ],
  },
  {
    label: 'Purple',
    colors: [
      { name: 'Electric Purple', hex: '#8B5CF6' },
      { name: 'Violet', hex: '#7C3AED' },
      { name: 'Deep Violet', hex: '#6D28D9' },
      { name: 'Lavender', hex: '#A78BFA' },
      { name: 'Neon Purple', hex: '#A855F7' },
      { name: 'Indigo', hex: '#6366F1' },
      { name: 'Royal Purple', hex: '#9333EA' },
    ],
  },
  {
    label: 'Green',
    colors: [
      { name: 'Emerald', hex: '#10B981' },
      { name: 'Mint', hex: '#34D399' },
      { name: 'Neon Green', hex: '#22C55E' },
      { name: 'Lime', hex: '#84CC16' },
      { name: 'Forest', hex: '#16A34A' },
      { name: 'Jade', hex: '#14B8A6' },
      { name: 'Sage', hex: '#84A98C' },
    ],
  },
  {
    label: 'Red',
    colors: [
      { name: 'Crimson', hex: '#EF4444' },
      { name: 'True Red', hex: '#FF3B30' },
      { name: 'Scarlet', hex: '#F43F5E' },
      { name: 'Ruby', hex: '#E11D48' },
      { name: 'Deep Red', hex: '#DC2626' },
      { name: 'Neon Red', hex: '#FF1744' },
    ],
  },
  {
    label: 'Orange',
    colors: [
      { name: 'Electric Orange', hex: '#FF8A00' },
      { name: 'Tangerine', hex: '#F97316' },
      { name: 'Amber', hex: '#F59E0B' },
      { name: 'Burnt Orange', hex: '#EA580C' },
      { name: 'Neon Orange', hex: '#FF6D00' },
      { name: 'Copper', hex: '#D97706' },
    ],
  },
  {
    label: 'Yellow / Gold',
    colors: [
      { name: 'Gold', hex: '#F5C542' },
      { name: 'Bright Gold', hex: '#FFD43B' },
      { name: 'Amber Gold', hex: '#FBBF24' },
      { name: 'Champagne', hex: '#F3DFA2' },
      { name: 'Brass', hex: '#D4A44C' },
      { name: 'Neon Yellow', hex: '#EFFF00' },
    ],
  },
  {
    label: 'Pink',
    colors: [
      { name: 'Hot Pink', hex: '#EC4899' },
      { name: 'Neon Pink', hex: '#FF2D95' },
      { name: 'Rose', hex: '#F43F5E' },
      { name: 'Magenta', hex: '#D946EF' },
      { name: 'Soft Pink', hex: '#F472B6' },
      { name: 'Fuchsia', hex: '#C026D3' },
    ],
  },
  {
    label: 'Cyan / Teal',
    colors: [
      { name: 'Cyan', hex: '#06B6D4' },
      { name: 'Electric Cyan', hex: '#00E5FF' },
      { name: 'Teal', hex: '#14B8A6' },
      { name: 'Aqua', hex: '#22D3EE' },
      { name: 'Turquoise', hex: '#2DD4BF' },
      { name: 'Arctic', hex: '#67E8F9' },
    ],
  },
  {
    label: 'Earth / Luxury',
    colors: [
      { name: 'Bronze', hex: '#CD7F32' },
      { name: 'Copper', hex: '#B87333' },
      { name: 'Terracotta', hex: '#E76F51' },
      { name: 'Mocha', hex: '#A67B5B' },
      { name: 'Sand', hex: '#D6B98C' },
      { name: 'Caramel', hex: '#C08457' },
    ],
  },
  {
    label: 'Monochrome',
    colors: [
      { name: 'Pure White', hex: '#FFFFFF' },
      { name: 'Silver', hex: '#C0C0C0' },
      { name: 'Platinum', hex: '#E5E7EB' },
      { name: 'Cool Gray', hex: '#94A3B8' },
      { name: 'Slate', hex: '#64748B' },
    ],
  },
];

/** Looks up a preset's display name for a given hex, if it matches one exactly. */
export function findPresetName(hex: string): string | null {
  const normalized = hex.toUpperCase();
  for (const group of ACCENT_PRESET_GROUPS) {
    const match = group.colors.find((c) => c.hex.toUpperCase() === normalized);
    if (match) return match.name;
  }
  return null;
}
