document.addEventListener('DOMContentLoaded', () => {
  // Determine which API to use (browser for Firefox, chrome for Chrome)
  const api = typeof browser !== 'undefined' ? browser : chrome;
  
  // Check if we should show the banner
  api.storage.local.get(["openWebUIUrl", "webSearchEnabled", "showUrlNeededBanner"])
    .then((result) => {
      if (result.openWebUIUrl) {
        document.getElementById('openWebUIUrl').value = result.openWebUIUrl;
      }
      
      if (result.webSearchEnabled !== undefined) {
        document.getElementById('webSearchEnabled').checked = result.webSearchEnabled;
      }

      // Display banner ONLY if flag is set AND no URL is configured yet
      if (result.showUrlNeededBanner && !result.openWebUIUrl) {
        document.getElementById('banner').style.display = 'block';
        document.getElementById('openWebUIUrl').focus();
      } else {
        // Make sure banner is hidden
        document.getElementById('banner').style.display = 'none';
      }
      
      // Always clear the flag after handling it, regardless of banner display
      if (result.showUrlNeededBanner) {
        api.storage.local.remove("showUrlNeededBanner");
      }
    })
    .catch(() => {});

  // Save settings when the save button is clicked
  document.getElementById('save').addEventListener('click', () => {
    let openWebUIUrl = document.getElementById('openWebUIUrl').value.trim();
    const webSearchEnabled = document.getElementById('webSearchEnabled').checked;
    
    // Validate URL
    if (!openWebUIUrl) {
      alert("Please enter a valid OpenWebUI URL");
      return;
    }

    // Add http:// prefix if the URL doesn't start with http:// or https://
    if (!openWebUIUrl.startsWith("http://") && !openWebUIUrl.startsWith("https://")) {
      openWebUIUrl = "http://" + openWebUIUrl;
      document.getElementById('openWebUIUrl').value = openWebUIUrl;
    }

    // Save settings
    api.storage.local.set({ 
      openWebUIUrl, 
      webSearchEnabled 
    })
    .then(() => {
      // Hide banner if it was visible
      document.getElementById('banner').style.display = 'none';
      
      // Show a confirmation message
      const status = document.getElementById('status');
      status.textContent = 'Options saved.';
      setTimeout(() => {
        status.textContent = '';
      }, 2000);
    })
    .catch(() => {
      alert("Failed to save settings.");
    });
  });
});
