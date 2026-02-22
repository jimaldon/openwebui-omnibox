# OpenWebUI Omnibox

A browser extension that lets you quickly search your OpenWebUI instance directly from the address bar. Available for **Firefox** and **Chrome**.

## Features

- 🚀 Access OpenWebUI directly from your browser's address bar
- ⚙️ Custom OpenWebUI URL configuration
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
3. Toggle "Enable Web Search" as desired
4. Click "Save"

To use:
1. In the address bar, type `o` followed by a space
2. Type your query
3. Press Enter to search

Example: `o what is the capital of France?`

## Keyboard Shortcuts

- **Enter**: Search in the current tab
- **Alt+Enter**: Search in a new tab
- **Ctrl+Enter**: Search in a background tab

## Building

Package the extensions into zip files for distribution:

```bash
# Build both extensions
npm run build

# Build Firefox only
npm run build:firefox

# Build Chrome only
npm run build:chrome
```

Output zip files are placed in the `dist/` directory.

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
