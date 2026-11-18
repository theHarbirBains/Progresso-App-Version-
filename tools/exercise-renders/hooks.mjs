// node --import ./tools/exercise-renders/hooks.mjs ...: lets Node import the app's TypeScript the
// way Metro does, a relative import without its extension resolving to its .ts, .tsx or index.ts.
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(specifier)) {
        for (const ext of ['.ts', '.tsx', '/index.ts']) {
          try {
            return nextResolve(specifier + ext, context);
          } catch {
            // Not this one: try the next.
          }
        }
      }
      throw error;
    }
  },
});
