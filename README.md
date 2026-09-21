# OpenWebUI Omnibox

A browser extension that lets you quickly search your OpenWebUI instance directly from the address bar. Available for **Firefox** and **Chrome**.

## Features

- 🚀 Access OpenWebUI directly from your browser's address bar
- ⚙️ Custom OpenWebUI URL configuration
- 🧩 Optional default model selection
- 🔍 Optional web search integration
- 🦊 Firefox support
- 🌐 Chrome support

## Project Structure

```
openwebui-omnibox/
├── firefox/          # Firefox add-on (Manifest V3, background scripts)
│   ├── manifest.json
│   ├── background.js
│   ├── icons/
│   ├── options/
│   └── search/
├── chrome/           # Chrome extension (Manifest V3, service worker)
│   ├── manifest.json
│   ├── background.js
│   ├── icons/
│   ├── options/
│   └── search/
├── package.json      # Build scripts
├── README.md
└── LICENSE
```

## Installation

### Firefox

#### From Firefox Add-ons (Recommended)

1. Visit the [OpenWebUI Omnibox page](https://addons.mozilla.org/firefox/addon/openwebui-omnibox/) on Firefox Add-ons
2. Click "Add to Firefox"
3. Follow the prompts to install

#### Manual Installation (Developer)

1. Clone this repository:
   ```
   git clone https://github.com/jimaldon/openwebui-omnibox.git
   ```
2. Open Firefox and navigate to `about:debugging`
3. Click "This Firefox"
4. Click "Load Temporary Add-on..."
5. Navigate to the `firefox/` folder and select `manifest.json`

### Chrome

#### Manual Installation (Developer)

1. Clone this repository:
   ```
   git clone https://github.com/jimaldon/openwebui-omnibox.git
   ```
2. Open Chrome and navigate to `chrome://extensions`
3. Enable "Developer mode" (toggle in the top right)
4. Click "Load unpacked"
5. Select the `chrome/` folder

## Usage

1. After installation, go to the extension's preferences/options
2. Set your OpenWebUI URL (e.g., `http://localhost:3000` or `https://your-openwebui-instance.com`)
3. Optionally set a **Default Model** (a model name/tag, e.g. `gpt-4o`) to launch searches with that model preselected
4. Toggle "Enable Web Search" as desired
5. Click "Save"

To use:
1. In the address bar, type `o` followed by a space
2. Type your query
3. Press Enter to search

Example: `o what is the capital of France?`

## Keyboard Shortcuts

- **Enter**: Search in the current tab
- **Alt+Enter**: Search in a new tab
- **Ctrl+Enter**: Search in a background tab

## Development

```bash
npm install            # installs deps and runs `wxt prepare`
npm run dev            # Chrome, with HMR (.output/chrome-mv3)
npm run dev:firefox    # Firefox, with HMR (.output/firefox-mv3)
```

## Building

The extension is built with [WXT](https://wxt.dev/). The version in
`package.json` is written into every generated manifest.

```bash
# Build Chrome -> .output/chrome-mv3
npm run build

# Build Firefox -> .output/firefox-mv3
npm run build:firefox
```

## Packaging for stores

```bash
# Chrome Web Store zip
npm run zip

# Firefox zip + AMO source zip
npm run zip:firefox
```

Output archives are written to `.output/`:
`openwebui-omnibox-<version>-chrome.zip`,
`openwebui-omnibox-<version>-firefox.zip`, and
`openwebui-omnibox-<version>-sources.zip`.

### Building from source (Firefox / AMO reviewers)

`npm run zip:firefox` also emits `openwebui-omnibox-<version>-sources.zip`.
To reproduce the submitted Firefox build from it:

```bash
unzip openwebui-omnibox-<version>-sources.zip -d openwebui-omnibox-src
cd openwebui-omnibox-src
npm ci
npm run build:firefox   # -> .output/firefox-mv3
```

## Releasing

Releases run from the **Release** workflow (`Actions → Release → Run workflow`).
It installs, typechecks, tests, builds both zips, validates the Chrome Web Store
credentials (`npm run check:chrome`), and submits to both stores. The `dry_run`
input defaults to **true** and only builds and validates credentials — set it to
false to actually upload, submit for review, and create a GitHub release.

Submissions need these repository secrets:

| Secret | Source |
|---|---|
| `CHROME_EXTENSION_ID` | Chrome Web Store developer dashboard (existing listing) |
| `CHROME_CLIENT_ID` / `CHROME_CLIENT_SECRET` / `CHROME_REFRESH_TOKEN` | Google Cloud OAuth client (CWS API v1.1) |
| `FIREFOX_EXTENSION_ID` | `{c7e8aea4-9959-4f22-a7fa-06d4e3e49434}` |
| `FIREFOX_JWT_ISSUER` / `FIREFOX_JWT_SECRET` | https://addons.mozilla.org/developers/addon/api/key/ |

Note: the Chrome Web Store API **v1.1** credentials above are deprecated and stop
working **2026-10-15**. Before then, create a Google service account with access
to the listing and switch the workflow to API **v2**
(`CHROME_API_VERSION: v2`, `CHROME_PUBLISHER_ID`,
`CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL`, `CHROME_SERVICE_ACCOUNT_PRIVATE_KEY`).

## Troubleshooting

- If nothing happens when you enter a query, make sure you've configured a valid OpenWebUI URL in the extension options
- Check that your OpenWebUI instance is running and accessible
- Ensure you're typing `o` followed by a space before entering your query

## Privacy

This extension:
- Does not collect any data
- Does not communicate with any servers except your specified OpenWebUI instance
- Stores only your preferences locally

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Acknowledgments

- This project is not officially affiliated with OpenWebUI
