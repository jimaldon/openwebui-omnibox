// Disable all debug logs by setting DEBUG to false
const DEBUG = false;

// Determine which API to use (browser for Firefox, chrome for Chrome)
const api = typeof browser !== 'undefined' ? browser : chrome;

// Build a search URL by parsing the configured base URL and merging in the
// query parameters, rather than blindly concatenating strings.
function buildSearchUrl(baseUrl, query, webSearchEnabled, model) {
  const url = new URL(baseUrl);
  url.searchParams.set("q", query);
  if (webSearchEnabled) {
    url.searchParams.set("web-search", "true");
  }
  if (model) {
    url.searchParams.set("model", model);
  }
  return url.toString();
}

// Return a parsed URL when the value is a usable http(s) URL, otherwise null.
function parseOpenWebUIUrl(value) {
  if (!value) return null;
  let url;
  try {
    url = new URL(value);
  } catch (err) {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return url;
}

// Function to load settings from storage
function loadSettings() {
  return api.storage.local.get(["openWebUIUrl", "openWebUIModel", "webSearchEnabled"])
    .then((result) => {
      const settings = {
        openWebUIUrl: result.openWebUIUrl || "",
        openWebUIModel: result.openWebUIModel || "",
        webSearchEnabled: result.webSearchEnabled !== undefined ? result.webSearchEnabled : true
      };
      if (DEBUG) console.log("Settings loaded:", settings.openWebUIUrl, settings.openWebUIModel, settings.webSearchEnabled);
      return settings;
    })
    .catch(err => {
      if (DEBUG) console.error("Error loading settings:", err);
      return { openWebUIUrl: "", openWebUIModel: "", webSearchEnabled: true };
    });
}

// Listen for changes to the omnibox input
api.omnibox.onInputEntered.addListener(async (text, disposition) => {
  // Always load settings fresh from storage to handle service worker restarts
  const { openWebUIUrl, openWebUIModel, webSearchEnabled } = await loadSettings();

  // Validate the openWebUIUrl
  if (!parseOpenWebUIUrl(openWebUIUrl)) {
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
  const url = buildSearchUrl(openWebUIUrl, text, webSearchEnabled, openWebUIModel);

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
