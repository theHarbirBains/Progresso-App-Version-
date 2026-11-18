import { registerHooks } from 'node:module';
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(specifier)) {
        for (const ext of ['.ts', '.tsx', '/index.ts']) {
          try { return nextResolve(specifier + ext, context); } catch {}
        }
      }
      throw error;
    }
  },
});
