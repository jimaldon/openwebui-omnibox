import { buildSearchUrl, parseOpenWebUIUrl } from '@/utils/url';

// Disable all debug logs by setting DEBUG to false
const DEBUG = false;

interface Settings {
  openWebUIUrl: string;
  openWebUIModel: string;
  webSearchEnabled: boolean;
}

// Load settings fresh from storage on each event so the handler is correct
// even after MV3 service-worker restarts.
async function loadSettings(): Promise<Settings> {
  try {
    const result = await browser.storage.local.get<{
      openWebUIUrl?: string;
      openWebUIModel?: string;
      webSearchEnabled?: boolean;
    }>(['openWebUIUrl', 'openWebUIModel', 'webSearchEnabled']);
    if (DEBUG) {
      console.log(
        'Settings loaded:',
        result.openWebUIUrl,
        result.openWebUIModel,
        result.webSearchEnabled,
      );
    }
    return {
      openWebUIUrl: result.openWebUIUrl || '',
      openWebUIModel: result.openWebUIModel || '',
      webSearchEnabled: result.webSearchEnabled !== undefined ? result.webSearchEnabled : true,
    };
  } catch (err) {
    if (DEBUG) console.error('Error loading settings:', err);
    return { openWebUIUrl: '', openWebUIModel: '', webSearchEnabled: true };
  }
}

export default defineBackground(() => {
  // Listen for changes to the omnibox input
  browser.omnibox.onInputEntered.addListener(async (text, disposition) => {
    const { openWebUIUrl, openWebUIModel, webSearchEnabled } = await loadSettings();

    // Validate the openWebUIUrl
    if (!parseOpenWebUIUrl(openWebUIUrl)) {
      // Open the options page with a parameter to show the banner
      browser.runtime
        .openOptionsPage()
        .then(() => {
          // Save a flag that we should show the URL needed banner
          browser.storage.local.set({ showUrlNeededBanner: true });
        })
        .catch((err) => {
          if (DEBUG) console.error('Error opening options page:', err);
        });
      return;
    }

    // Construct the query URL
    const url = buildSearchUrl(openWebUIUrl, text, webSearchEnabled, openWebUIModel);

    // Open the URL based on disposition
    try {
      switch (disposition) {
        case 'currentTab':
          browser.tabs.update({ url });
          break;
        case 'newForegroundTab':
          browser.tabs.create({ url });
          break;
        case 'newBackgroundTab':
          browser.tabs.create({ url, active: false });
          break;
        default:
          browser.tabs.update({ url });
          break;
      }
    } catch (err) {
      if (DEBUG) console.error('Error opening tab:', err);
    }
  });
});
