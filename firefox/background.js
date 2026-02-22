// Disable all debug logs by setting DEBUG to false
const DEBUG = false;

// Default configuration
let openWebUIUrl = "";
let webSearchEnabled = true;
let settingsLoaded = false;

// Determine which API to use (browser for Firefox, chrome for Chrome)
const api = typeof browser !== 'undefined' ? browser : chrome;

// Function to load settings from storage
function loadSettings() {
  return api.storage.local.get(["openWebUIUrl", "webSearchEnabled"])
    .then((result) => {
      if (result.openWebUIUrl) {
        openWebUIUrl = result.openWebUIUrl;
      }
      if (result.webSearchEnabled !== undefined) {
        webSearchEnabled = result.webSearchEnabled;
      }
      settingsLoaded = true;
      if (DEBUG) console.log("Settings loaded:", openWebUIUrl, webSearchEnabled);
    })
    .catch(err => {
      settingsLoaded = true; // Mark as loaded even on error to prevent infinite redirects
      if (DEBUG) console.error("Error loading settings:", err);
    });
}

// Load settings on startup
loadSettings();

// Listen for changes to storage
api.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  
  if (changes.openWebUIUrl) {
    openWebUIUrl = changes.openWebUIUrl.newValue;
  }
  
  if (changes.webSearchEnabled) {
    webSearchEnabled = changes.webSearchEnabled.newValue;
  }
});

// Listen for changes to the omnibox input
api.omnibox.onInputEntered.addListener(async (text, disposition) => {
  // Make sure settings are loaded before proceeding
  if (!settingsLoaded) {
    await loadSettings();
  }

  // Validate the openWebUIUrl
  if (!openWebUIUrl || openWebUIUrl === "" || (!openWebUIUrl.startsWith("http://") && !openWebUIUrl.startsWith("https://"))) {
    // Open the options page with a parameter to show the banner
    api.runtime.openOptionsPage().then(() => {
      // Save a flag that we should show the URL needed banner
      api.storage.local.set({ showUrlNeededBanner: true });
    }).catch(err => {
      if (DEBUG) console.error("Error opening options page:", err);
    });
    return;
  }

  // Construct the query URL
  const queryParam = encodeURIComponent(text);
  const searchParam = webSearchEnabled ? "&web-search=true" : "";
  const url = `${openWebUIUrl}/?q=${queryParam}${searchParam}`;

  // Open the URL based on disposition
  try {
    switch (disposition) {
      case 'currentTab':
        api.tabs.update({ url });
        break;
      case 'newForegroundTab':
        api.tabs.create({ url });
        break;
      case 'newBackgroundTab':
        api.tabs.create({ url, active: false });
        break;
      default:
        api.tabs.update({ url });
        break;
    }
  } catch (err) {
    if (DEBUG) console.error("Error opening tab:", err);
  }
});
