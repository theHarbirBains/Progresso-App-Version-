import type { MaterialCommunityIcons } from '@expo/vector-icons';

export type FoodGlyphName = keyof typeof MaterialCommunityIcons.glyphMap;

// Which glyph stands in for a food that has no photograph. It is a plain
// category mark (a drumstick, a fish, an apple), chosen from the food's name --
// never a picture of that food, so nothing here pretends to be a photo.
// First match wins, so the more specific words come first ("peanut butter"
// before "butter", "egg white" before nothing else).
const RULES: { glyph: FoodGlyphName; words: string[] }[] = [
  { glyph: 'peanut', words: ['peanut', 'almond', 'walnut', 'cashew', 'pistachio', 'nut'] },
  { glyph: 'seed', words: ['chia', 'seed', 'flax', 'bean', 'lentil', 'chickpea', 'pea'] },
  { glyph: 'egg', words: ['egg'] },
  { glyph: 'fish', words: ['salmon', 'tuna', 'shrimp', 'cod', 'tilapia', 'fish', 'sardine'] },
  { glyph: 'food-drumstick', words: ['chicken', 'turkey', 'duck'] },
  { glyph: 'food-steak', words: ['beef', 'steak', 'pork', 'bacon', 'ham', 'lamb', 'sausage'] },
  { glyph: 'cheese', words: ['cheese'] },
  { glyph: 'cow', words: ['milk', 'yogurt', 'yoghurt', 'butter', 'cream', 'kefir'] },
  { glyph: 'oil', words: ['oil'] },
  { glyph: 'pasta', words: ['pasta', 'noodle', 'spaghetti', 'macaroni'] },
  {
    glyph: 'rice',
    words: ['rice', 'quinoa', 'oat', 'oatmeal', 'cereal', 'granola', 'barley', 'couscous'],
  },
  {
    glyph: 'bread-slice',
    words: ['bread', 'toast', 'bagel', 'tortilla', 'bun', 'wrap', 'cracker'],
  },
  { glyph: 'food-apple', words: ['apple', 'banana', 'mango', 'pear', 'peach', 'plum', 'avocado'] },
  { glyph: 'fruit-citrus', words: ['orange', 'lemon', 'lime', 'grapefruit'] },
  { glyph: 'fruit-grapes', words: ['grape', 'berry', 'berries', 'cherry', 'cherries'] },
  {
    glyph: 'carrot',
    words: ['carrot', 'broccoli', 'spinach', 'pepper', 'tomato', 'cucumber', 'potato', 'lettuce'],
  },
  { glyph: 'sprout', words: ['tofu', 'tempeh', 'soy', 'vegetable', 'salad', 'kale', 'cabbage'] },
  { glyph: 'cookie', words: ['cookie', 'biscuit', 'cake', 'chocolate', 'candy', 'sweet', 'bar'] },
  { glyph: 'cup', words: ['juice', 'soda', 'coffee', 'tea', 'water', 'drink', 'shake'] },
];

function matches(word: string, ruleWord: string): boolean {
  if (word === ruleWord || word === `${ruleWord}s`) return true;
  return ruleWord.length >= 5 && (word.endsWith(ruleWord) || word.endsWith(`${ruleWord}s`));
}

const FALLBACK: FoodGlyphName = 'silverware-fork-knife';

/** Matches a rule word as a whole word, its plural, or (for longer words) the end of a compound ("strawberries" ends in "berries"). */
export function foodGlyph(name: string): FoodGlyphName {
  const words = name
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
  for (const rule of RULES) {
    if (words.some((word) => rule.words.some((w) => matches(word, w)))) {
      return rule.glyph;
    }
  }
  return FALLBACK;
}
