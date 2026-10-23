import { Alert } from 'react-native';
import { recordQuietFailure } from '../lib/sentry';
import type { HomeWidgets } from './homeWidgetsTypes';

// The widgets and the Lock Screen card (homeWidgets) are loaded the first time one is updated,
// not when the app starts, and then created -- created, not just loaded, because creating them is
// what hands iOS each layout. Metro treats a file that fails while it loads after startup as
// fatal, whatever catches it, so homeWidgets does nothing as it loads; the creating is the plain
// call below, where a failure can be caught. If it fails, the app carries on without widgets --
// recorded, and said once, so it's seen rather than silently missing. A failure updating one
// (Live Activities turned off, say) is recorded only.

type HomeWidgetsFile = typeof import('./homeWidgets');

let widgets: HomeWidgets | null = null;
let loadFailed = false;

/** Runs `run` with the widgets once they're created; never throws. */
export async function withWidgets(
  area: string,
  run: (loaded: HomeWidgets) => unknown,
): Promise<void> {
  if (loadFailed) return;
  let loaded: HomeWidgets;
  try {
    // A require inside a function is what defers loading them to here.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    widgets ??= (require('./homeWidgets') as HomeWidgetsFile).homeWidgets();
    loaded = widgets;
  } catch (error) {
    loadFailed = true;
    recordQuietFailure('widget.load', error);
    Alert.alert(
      'Home Screen widgets couldn’t start',
      `Progresso works as usual; its widgets won't update. ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return;
  }
  try {
    await run(loaded);
  } catch (error) {
    recordQuietFailure(`widget.${area}`, error);
  }
}
