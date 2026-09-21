#!/usr/bin/env node
// Validate Chrome Web Store credentials without uploading or publishing.
//
// `wxt submit --dry-run` skips the Chrome token exchange entirely, so a green
// dry run says nothing about the Chrome credentials. This exchanges the refresh
// token for an access token and reads the existing listing, proving both the
// credentials and CHROME_EXTENSION_ID work. Exits non-zero with a specific
// reason on failure.

const missing = [
  'CHROME_CLIENT_ID',
  'CHROME_CLIENT_SECRET',
  'CHROME_REFRESH_TOKEN',
  'CHROME_EXTENSION_ID',
].filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.error(`✖ Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const { CHROME_CLIENT_ID, CHROME_CLIENT_SECRET, CHROME_REFRESH_TOKEN, CHROME_EXTENSION_ID } =
  process.env;

const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: CHROME_CLIENT_ID,
    client_secret: CHROME_CLIENT_SECRET,
    refresh_token: CHROME_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  }),
});
const token = await tokenRes.json().catch(() => ({}));

if (!tokenRes.ok || !token.access_token) {
  console.error('✖ Could not exchange CHROME_REFRESH_TOKEN for an access token.');
  console.error(`  HTTP ${tokenRes.status} ${token.error ?? ''} ${token.error_description ?? ''}`);
  console.error(
    '  Usually a wrong client ID/secret, a rotated secret, or an expired/revoked refresh token.',
  );
  process.exit(1);
}
console.log('✔ Refresh token exchanged for an access token.');

const itemRes = await fetch(
  `https://chromewebstore.googleapis.com/chromewebstore/v1.1/items/${encodeURIComponent(CHROME_EXTENSION_ID)}`,
  {
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      'x-goog-api-version': '2',
    },
  },
);
const item = await itemRes.json().catch(() => ({}));

if (!itemRes.ok) {
  console.error(`✖ Chrome Web Store rejected access to item ${CHROME_EXTENSION_ID}.`);
  console.error(`  HTTP ${itemRes.status}: ${item?.error?.message ?? JSON.stringify(item)}`);
  console.error('  Check that CHROME_EXTENSION_ID is the existing listing and the account owns it.');
  process.exit(1);
}

console.log(
  `✔ Chrome Web Store item ${CHROME_EXTENSION_ID} is accessible (current version: ${item.crxVersion ?? 'none published'}).`,
);
