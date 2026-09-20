import { test, expect } from 'vitest';
import { buildSearchUrl, parseOpenWebUIUrl } from '../utils/url';

test('helpers are defined', () => {
  expect(typeof buildSearchUrl).toBe('function');
  expect(typeof parseOpenWebUIUrl).toBe('function');
});

test('trailing-slash base does not produce a double slash', () => {
  expect(
    buildSearchUrl('https://my-local-openai-instance.localsite/', 'hello world', true),
  ).toBe('https://my-local-openai-instance.localsite/?q=hello+world&web-search=true');
});

test('base without path gets a root path', () => {
  expect(buildSearchUrl('https://host', 'hello', true)).toBe(
    'https://host/?q=hello&web-search=true',
  );
});

test('base path is preserved', () => {
  expect(buildSearchUrl('https://host/openwebui/', 'hello', true)).toBe(
    'https://host/openwebui/?q=hello&web-search=true',
  );
  expect(buildSearchUrl('https://host/openwebui', 'hello', true)).toBe(
    'https://host/openwebui?q=hello&web-search=true',
  );
});

test('existing query string is merged, not clobbered', () => {
  const result = buildSearchUrl('https://host/?foo=bar', 'hello', true);
  expect(result).toBe('https://host/?foo=bar&q=hello&web-search=true');
});

test('existing q value is replaced', () => {
  expect(buildSearchUrl('https://host/?q=old', 'new', true)).toBe(
    'https://host/?q=new&web-search=true',
  );
});

test('model param is added when configured', () => {
  expect(buildSearchUrl('https://host/', 'hello', true, 'gpt-4o')).toBe(
    'https://host/?q=hello&web-search=true&model=gpt-4o',
  );
});

test('model param is omitted when empty', () => {
  expect(buildSearchUrl('https://host/', 'hello', true, '')).toBe(
    'https://host/?q=hello&web-search=true',
  );
  expect(buildSearchUrl('https://host/', 'hello', true)).toBe(
    'https://host/?q=hello&web-search=true',
  );
});

test('model param is merged with an existing query string', () => {
  expect(buildSearchUrl('https://host/?foo=bar', 'hello', false, 'my-model')).toBe(
    'https://host/?foo=bar&q=hello&model=my-model',
  );
});

test('web-search param is omitted when disabled', () => {
  expect(buildSearchUrl('https://host/p/', 'hello', false)).toBe('https://host/p/?q=hello');
});

test('query text round-trips exactly', () => {
  const query = 'a&b=c /? #frag';
  const result = buildSearchUrl('https://host/', query, true);
  expect(new URL(result).searchParams.get('q')).toBe(query);
});

test('fragment is preserved', () => {
  expect(buildSearchUrl('https://host/base?foo=bar#frag', 'x', true)).toBe(
    'https://host/base?foo=bar&q=x&web-search=true#frag',
  );
});

test('parseOpenWebUIUrl rejects unusable URLs', () => {
  expect(parseOpenWebUIUrl('')).toBeNull();
  expect(parseOpenWebUIUrl('not a url')).toBeNull();
  expect(parseOpenWebUIUrl('ftp://host/')).toBeNull();
});

test('parseOpenWebUIUrl accepts http(s) URLs', () => {
  expect(parseOpenWebUIUrl('https://host/')?.protocol).toBe('https:');
  expect(parseOpenWebUIUrl('http://host')?.protocol).toBe('http:');
});
