// loadWidgets loads and creates the widgets on first use. Loaded here in a fresh module registry
// each time, so creating the widgets can be made to fail; the Alert spied on is that registry's
// own.

function loadWith(homeWidgets: () => unknown, builtWithWidgets = true) {
  return loadModule(() => ({ homeWidgets }), builtWithWidgets);
}

function loadModule(homeWidgetsFile: () => unknown, builtWithWidgets = true) {
  const recordQuietFailure = jest.fn();
  jest.resetModules();
  jest.doMock('../lib/sentry', () => ({ recordQuietFailure }));
  jest.doMock('./homeWidgets', homeWidgetsFile);
  jest.doMock('../lib/nativeModules', () => ({ hasWidgetsNative: () => builtWithWidgets }));
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

it("carries on when iOS won't take the widgets -- recorded, said once, and not tried again", async () => {
  const create = jest.fn(() => {
    throw new Error("Calling the 'constructor' function has failed");
  });
  const { withWidgets, recordQuietFailure, alert } = loadWith(create);
  const run = jest.fn();

  await expect(withWidgets('nutrition', run)).resolves.toBeUndefined();
  await withWidgets('steps', run);

  expect(run).not.toHaveBeenCalled();
  expect(recordQuietFailure).toHaveBeenCalledWith('widget.load', expect.any(Error));
  expect(alert).toHaveBeenCalledTimes(1);
  expect(alert).toHaveBeenCalledWith(
    'Home Screen widgets couldn’t start',
    expect.stringContaining("Calling the 'constructor' function has failed"),
  );
  expect(create).toHaveBeenCalledTimes(1);
});

it('loads nothing, and says nothing, where the app has no widgets -- Expo Go, Android', async () => {
  const create = jest.fn(() => ({}));
  const run = jest.fn();
  const { withWidgets, recordQuietFailure, alert } = loadWith(create, false);

  await withWidgets('nutrition', run);

  expect(create).not.toHaveBeenCalled();
  expect(run).not.toHaveBeenCalled();
  expect(recordQuietFailure).not.toHaveBeenCalled();
  expect(alert).not.toHaveBeenCalled();
});

it('creates the widgets once, however many updates there are', async () => {
  const create = jest.fn(() => ({}));
  const { withWidgets } = loadWith(create);

  await withWidgets('nutrition', () => undefined);
  await withWidgets('steps', () => undefined);

  expect(create).toHaveBeenCalledTimes(1);
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
