import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Scrolling puts the keyboard away, everywhere: a field being typed into never sits over what's
// being scrolled to. Every scrolling list -- ScrollView, FlatList, SectionList, the shared
// Screen's own -- says so with keyboardDismissMode, and this keeps a new one from forgetting.

const SCROLLERS =
  /<(ScrollView|FlatList|SectionList|Animated\.ScrollView|Animated\.FlatList)(?=[\s/>])/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__mocks__' ? [] : sourceFiles(path);
    return name.endsWith('.tsx') && !name.includes('.test.') ? [path] : [];
  });
}

/** The opening tag starting at `from`: up to the first `>` outside braces. */
function openingTag(source: string, from: number): string {
  let depth = 0;
  for (let i = from + 1; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '>' && depth === 0 && source[i - 1] !== '=') return source.slice(from, i + 1);
  }
  return source.slice(from);
}

describe('the keyboard and scrolling', () => {
  it('puts the keyboard away when any list is scrolled', () => {
    const root = __dirname;
    const missing: string[] = [];
    for (const file of sourceFiles(root)) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(SCROLLERS)) {
        if (!openingTag(source, match.index!).includes('keyboardDismissMode')) {
          const line = source.slice(0, match.index).split('\n').length;
          missing.push(`${relative(root, file)}:${line} <${match[1]}>`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
