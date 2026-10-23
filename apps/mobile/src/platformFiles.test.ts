import * as fs from 'fs';
import * as path from 'path';

// Metro (which builds the app) finds `./x` by going through the source extensions in order --
// ts, tsx, js, jsx -- and, for each, trying the platform's file before the shared one. So a
// shared `x.ts` is picked over `x.ios.tsx` even on iPhone. Jest looks the other way round, platform
// files first, so tests pass while the app runs the wrong file: builds 28 to 30 shipped the
// widgets' do-nothing fallback (widgets/homeWidgets) this way and crashed at launch. A platform
// file's shared fallback must not use an extension Metro tries before the platform file's own.

const EXTENSIONS = ['ts', 'tsx', 'js', 'jsx'];
const PLATFORMS = ['ios', 'android', 'native', 'web'];
const PLATFORM_FILE = new RegExp(`^(.+)\\.(${PLATFORMS.join('|')})\\.(${EXTENSIONS.join('|')})$`);

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourceFiles(full);
    return [full];
  });
}

const platformFiles = sourceFiles(__dirname).flatMap((file) => {
  const match = path.basename(file).match(PLATFORM_FILE);
  return match ? [{ file, base: match[1], ext: match[3] }] : [];
});

it('finds the platform files it checks', () => {
  expect(platformFiles.map((p) => path.basename(p.file))).toContain('homeWidgets.ios.tsx');
});

it.each(platformFiles.map((p) => [path.relative(__dirname, p.file), p] as const))(
  '%s is the file Metro picks on its platform',
  (_name, { file, base, ext }) => {
    const shadowing = EXTENSIONS.slice(0, EXTENSIONS.indexOf(ext))
      .map((earlier) => path.join(path.dirname(file), `${base}.${earlier}`))
      .filter((candidate) => fs.existsSync(candidate));
    expect(shadowing).toEqual([]);
  },
);
