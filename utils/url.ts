// Pure URL helpers shared by the background script and the options page.
// Kept free of any extension/browser globals so they can be unit-tested
// directly (see test/url.test.ts).

/**
 * Build a search URL by parsing the configured base URL and merging in the
 * query parameters, rather than blindly concatenating strings.
 */
export function buildSearchUrl(
  baseUrl: string,
  query: string,
  webSearchEnabled: boolean,
  model?: string,
): string {
  const url = new URL(baseUrl);
  url.searchParams.set('q', query);
  if (webSearchEnabled) {
    url.searchParams.set('web-search', 'true');
  }
  if (model) {
    url.searchParams.set('model', model);
  }
  return url.toString();
}

/**
 * Return a parsed URL when the value is a usable http(s) URL, otherwise null.
 */
export function parseOpenWebUIUrl(value: string | null | undefined): URL | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  return url;
}
