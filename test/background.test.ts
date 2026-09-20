import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import background from '../entrypoints/background';

type OmniboxListener = (text: string, disposition: string) => void | Promise<void>;

const WEBUI_URL = 'https://host/';

let listener: OmniboxListener;

// @webext-core/fake-browser has no omnibox implementation, so capture the
// listener the background registers with a minimal stub.
function stubOmnibox() {
  (fakeBrowser as unknown as { omnibox: unknown }).omnibox = {
    onInputEntered: {
      addListener: (cb: OmniboxListener) => {
        listener = cb;
      },
    },
  };
}

async function start(settings: Record<string, unknown> = {}) {
  fakeBrowser.reset();
  await fakeBrowser.storage.local.set({
    openWebUIUrl: WEBUI_URL,
    openWebUIModel: '',
    webSearchEnabled: true,
    ...settings,
  });
  stubOmnibox();
  (background.main as () => void)();
}

describe('omnibox handler', () => {
  beforeEach(async () => {
    await start();
  });

  test('currentTab opens the search URL in the current tab', async () => {
    const update = vi
      .spyOn(fakeBrowser.tabs, 'update')
      .mockImplementation(async () => undefined as never);

    await listener('hello', 'currentTab');

    expect(update).toHaveBeenCalledWith({
      url: 'https://host/?q=hello&web-search=true',
    });
  });

  test('newForegroundTab opens a new tab', async () => {
    const create = vi
      .spyOn(fakeBrowser.tabs, 'create')
      .mockImplementation(async () => undefined as never);

    await listener('hello', 'newForegroundTab');

    expect(create).toHaveBeenCalledWith({ url: 'https://host/?q=hello&web-search=true' });
  });

  test('newBackgroundTab opens a new inactive tab', async () => {
    const create = vi
      .spyOn(fakeBrowser.tabs, 'create')
      .mockImplementation(async () => undefined as never);

    await listener('hello', 'newBackgroundTab');

    expect(create).toHaveBeenCalledWith({
      url: 'https://host/?q=hello&web-search=true',
      active: false,
    });
  });

  test('model and web-search settings are applied', async () => {
    await start({ openWebUIModel: 'gpt-4o', webSearchEnabled: false });
    const update = vi
      .spyOn(fakeBrowser.tabs, 'update')
      .mockImplementation(async () => undefined as never);

    await listener('hello', 'currentTab');

    expect(update).toHaveBeenCalledWith({ url: 'https://host/?q=hello&model=gpt-4o' });
  });

  test('unconfigured URL opens options and sets the banner flag', async () => {
    await start({ openWebUIUrl: '' });
    const openOptionsPage = vi
      .spyOn(fakeBrowser.runtime, 'openOptionsPage')
      .mockImplementation(async () => undefined as never);
    const update = vi
      .spyOn(fakeBrowser.tabs, 'update')
      .mockImplementation(async () => undefined as never);

    await listener('hello', 'currentTab');

    expect(openOptionsPage).toHaveBeenCalledOnce();
    expect(update).not.toHaveBeenCalled();
    await vi.waitFor(async () => {
      expect(await fakeBrowser.storage.local.get('showUrlNeededBanner')).toEqual({
        showUrlNeededBanner: true,
      });
    });
  });
});
