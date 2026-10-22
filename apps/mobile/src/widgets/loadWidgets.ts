import { Alert } from 'react-native';
import { recordQuietFailure } from '../lib/sentry';

// The widgets and the Lock Screen card (homeWidgets) are loaded the first time one is updated,
// not when the app starts: loading them sets up their native side, and that must never be able
// to stop the app opening. If they can't be loaded, the app carries on without them -- recorded,
// and said once per launch, so it's seen rather than silently missing. A failure updating one
// (Live Activities turned off, say) is recorded only.

type HomeWidgets = typeof import('./homeWidgets');

let widgets: HomeWidgets | null = null;
let toldLoadFailure = false;

/** Runs `run` with the widgets once they're loaded; never throws. */
export async function withWidgets(
  area: string,
  run: (loaded: HomeWidgets) => unknown,
): Promise<void> {
  let loaded: HomeWidgets;
  try {
    // A require inside a function is what defers loading them to here.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    widgets ??= require('./homeWidgets') as HomeWidgets;
    loaded = widgets;
  } catch (error) {
    recordQuietFailure('widget.load', error);
    if (!toldLoadFailure) {
      toldLoadFailure = true;
      Alert.alert(
        'Home Screen widgets couldn’t start',
        `Progresso works as usual; its widgets won't update. ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    return;
  }
  try {
    await run(loaded);
  } catch (error) {
    recordQuietFailure(`widget.${area}`, error);
  }
}
