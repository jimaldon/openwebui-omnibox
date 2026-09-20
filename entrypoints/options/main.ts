import { parseOpenWebUIUrl } from '@/utils/url';

document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('openWebUIUrl') as HTMLInputElement;
  const modelInput = document.getElementById('openWebUIModel') as HTMLInputElement;
  const webSearchInput = document.getElementById('webSearchEnabled') as HTMLInputElement;
  const banner = document.getElementById('banner') as HTMLDivElement;
  const status = document.getElementById('status') as HTMLDivElement;
  const saveButton = document.getElementById('save') as HTMLButtonElement;

  // Check if we should show the banner
  browser.storage.local
    .get<{
      openWebUIUrl?: string;
      openWebUIModel?: string;
      webSearchEnabled?: boolean;
      showUrlNeededBanner?: boolean;
    }>(['openWebUIUrl', 'openWebUIModel', 'webSearchEnabled', 'showUrlNeededBanner'])
    .then((result) => {
      if (result.openWebUIUrl) {
        urlInput.value = result.openWebUIUrl;
      }

      if (result.openWebUIModel !== undefined) {
        modelInput.value = result.openWebUIModel;
      }

      if (result.webSearchEnabled !== undefined) {
        webSearchInput.checked = result.webSearchEnabled;
      }

      // Display banner ONLY if flag is set AND no URL is configured yet
      if (result.showUrlNeededBanner && !result.openWebUIUrl) {
        banner.style.display = 'block';
        urlInput.focus();
      } else {
        // Make sure banner is hidden
        banner.style.display = 'none';
      }

      // Always clear the flag after handling it, regardless of banner display
      if (result.showUrlNeededBanner) {
        browser.storage.local.remove('showUrlNeededBanner');
      }
    })
    .catch(() => {});

  // Save settings when the save button is clicked
  saveButton.addEventListener('click', () => {
    let openWebUIUrl = urlInput.value.trim();
    const openWebUIModel = modelInput.value.trim();
    const webSearchEnabled = webSearchInput.checked;

    // Validate URL
    if (!openWebUIUrl) {
      alert('Please enter a valid OpenWebUI URL');
      return;
    }

    // Add http:// prefix if the URL doesn't start with http:// or https://
    if (!openWebUIUrl.startsWith('http://') && !openWebUIUrl.startsWith('https://')) {
      openWebUIUrl = 'http://' + openWebUIUrl;
    }

    // Ensure the URL is well-formed and uses http(s)
    if (!parseOpenWebUIUrl(openWebUIUrl)) {
      alert('Please enter a valid OpenWebUI URL');
      return;
    }
    urlInput.value = openWebUIUrl;

    // Save settings
    browser.storage.local
      .set({
        openWebUIUrl,
        openWebUIModel,
        webSearchEnabled,
      })
      .then(() => {
        // Hide banner if it was visible
        banner.style.display = 'none';

        // Show a confirmation message
        status.textContent = 'Options saved.';
        setTimeout(() => {
          status.textContent = '';
        }, 2000);
      })
      .catch(() => {
        alert('Failed to save settings.');
      });
  });
});
