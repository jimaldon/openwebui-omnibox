"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Both extensions ship the same URL helpers; run the real background scripts.
const EXTENSIONS = ["chrome", "firefox"];

// Minimal stubs so a background script can be evaluated outside a browser.
function makeApiStub() {
  const noop = () => {};
  return {
    omnibox: { onInputEntered: { addListener: noop } },
    runtime: { openOptionsPage: () => Promise.resolve() },
    tabs: { update: noop, create: noop },
    storage: {
      local: {
        get: () => Promise.resolve({}),
        set: () => Promise.resolve(),
        remove: () => Promise.resolve(),
      },
      onChanged: { addListener: noop },
    },
  };
}

function loadBackground(dir) {
  const file = path.join(__dirname, "..", dir, "background.js");
  const source = fs.readFileSync(file, "utf8");
  const context = vm.createContext({
    URL,
    URLSearchParams,
    console,
    chrome: makeApiStub(),
  });
  vm.runInContext(source, context, { filename: file });
  return context;
}

for (const dir of EXTENSIONS) {
  const ctx = loadBackground(dir);
  const { buildSearchUrl, parseOpenWebUIUrl } = ctx;

  test(`[${dir}] helpers are defined`, () => {
    assert.equal(typeof buildSearchUrl, "function");
    assert.equal(typeof parseOpenWebUIUrl, "function");
  });

  test(`[${dir}] trailing-slash base does not produce a double slash`, () => {
    assert.equal(
      buildSearchUrl("https://my-local-openai-instance.localsite/", "hello world", true),
      "https://my-local-openai-instance.localsite/?q=hello+world&web-search=true"
    );
  });

  test(`[${dir}] base without path gets a root path`, () => {
    assert.equal(
      buildSearchUrl("https://host", "hello", true),
      "https://host/?q=hello&web-search=true"
    );
  });

  test(`[${dir}] base path is preserved`, () => {
    assert.equal(
      buildSearchUrl("https://host/openwebui/", "hello", true),
      "https://host/openwebui/?q=hello&web-search=true"
    );
    assert.equal(
      buildSearchUrl("https://host/openwebui", "hello", true),
      "https://host/openwebui?q=hello&web-search=true"
    );
  });

  test(`[${dir}] existing query string is merged, not clobbered`, () => {
    const result = buildSearchUrl("https://host/?foo=bar", "hello", true);
    assert.equal(result, "https://host/?foo=bar&q=hello&web-search=true");
  });

  test(`[${dir}] existing q value is replaced`, () => {
    assert.equal(
      buildSearchUrl("https://host/?q=old", "new", true),
      "https://host/?q=new&web-search=true"
    );
  });

  test(`[${dir}] model param is added when configured`, () => {
    assert.equal(
      buildSearchUrl("https://host/", "hello", true, "gpt-4o"),
      "https://host/?q=hello&web-search=true&model=gpt-4o"
    );
  });

  test(`[${dir}] model param is omitted when empty`, () => {
    assert.equal(
      buildSearchUrl("https://host/", "hello", true, ""),
      "https://host/?q=hello&web-search=true"
    );
    assert.equal(
      buildSearchUrl("https://host/", "hello", true),
      "https://host/?q=hello&web-search=true"
    );
  });

  test(`[${dir}] model param is merged with an existing query string`, () => {
    assert.equal(
      buildSearchUrl("https://host/?foo=bar", "hello", false, "my-model"),
      "https://host/?foo=bar&q=hello&model=my-model"
    );
  });

  test(`[${dir}] web-search param is omitted when disabled`, () => {
    assert.equal(
      buildSearchUrl("https://host/p/", "hello", false),
      "https://host/p/?q=hello"
    );
  });

  test(`[${dir}] query text round-trips exactly`, () => {
    const query = "a&b=c /? #frag";
    const result = buildSearchUrl("https://host/", query, true);
    assert.equal(new URL(result).searchParams.get("q"), query);
  });

  test(`[${dir}] fragment is preserved`, () => {
    assert.equal(
      buildSearchUrl("https://host/base?foo=bar#frag", "x", true),
      "https://host/base?foo=bar&q=x&web-search=true#frag"
    );
  });

  test(`[${dir}] parseOpenWebUIUrl rejects unusable URLs`, () => {
    assert.equal(parseOpenWebUIUrl(""), null);
    assert.equal(parseOpenWebUIUrl("not a url"), null);
    assert.equal(parseOpenWebUIUrl("ftp://host/"), null);
  });

  test(`[${dir}] parseOpenWebUIUrl accepts http(s) URLs`, () => {
    assert.equal(parseOpenWebUIUrl("https://host/").protocol, "https:");
    assert.equal(parseOpenWebUIUrl("http://host").protocol, "http:");
  });
}
