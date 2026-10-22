// loadWidgets loads the widgets on first use. Loaded here in a fresh module registry each time,
// so the widgets can be made to fail to load; the Alert spied on is that registry's own.

function loadWith(homeWidgets: () => unknown) {
  const recordQuietFailure = jest.fn();
  jest.resetModules();
  jest.doMock('../lib/sentry', () => ({ recordQuietFailure }));
  jest.doMock('./homeWidgets', homeWidgets);
  const { Alert } = jest.requireActual<typeof import('react-native')>('react-native');
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const { withWidgets } = jest.requireActual<typeof import('./loadWidgets')>('./loadWidgets');
  return { withWidgets, recordQuietFailure, alert };
}

it('hands over the widgets once loaded', async () => {
  const nutritionWidget = { updateSnapshot: jest.fn() };
  const { withWidgets } = loadWith(() => ({ nutritionWidget }));

  await withWidgets('nutrition', (loaded) =>
    (loaded.nutritionWidget.updateSnapshot as jest.Mock)({ signedIn: true }),
  );

  expect(nutritionWidget.updateSnapshot).toHaveBeenCalledWith({ signedIn: true });
});

it("carries on when the widgets can't load -- recorded, and said once", async () => {
  const { withWidgets, recordQuietFailure, alert } = loadWith(() => {
    throw new Error("Cannot find native module 'ExpoWidgets'");
  });
  const run = jest.fn();

  await expect(withWidgets('nutrition', run)).resolves.toBeUndefined();
  await withWidgets('steps', run);

  expect(run).not.toHaveBeenCalled();
  expect(recordQuietFailure).toHaveBeenCalledWith('widget.load', expect.any(Error));
  expect(alert).toHaveBeenCalledTimes(1);
  expect(alert).toHaveBeenCalledWith(
    'Home Screen widgets couldn’t start',
    expect.stringContaining("Cannot find native module 'ExpoWidgets'"),
  );
});

it('records a widget that fails to update, without saying so', async () => {
  const { withWidgets, recordQuietFailure, alert } = loadWith(() => ({}));
  const failure = new Error('Live Activities are off');

  await withWidgets('workoutActivity', () => {
    throw failure;
  });

  expect(recordQuietFailure).toHaveBeenCalledWith('widget.workoutActivity', failure);
  expect(alert).not.toHaveBeenCalled();
});
