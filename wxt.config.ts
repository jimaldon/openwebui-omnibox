import { defineConfig } from 'wxt';

const FIREFOX_ADDON_ID = '{c7e8aea4-9959-4f22-a7fa-06d4e3e49434}';

export default defineConfig({
  srcDir: '.',
  outDir: '.output',
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    name: 'OpenWebUI Omnibox',
    description: 'Access OpenWebUI directly from the address bar',
    permissions: ['storage'],
    omnibox: {
      keyword: 'o',
    },
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: FIREFOX_ADDON_ID,
          strict_min_version: '109.0',
          data_collection_permissions: {
            required: ['none'],
          },
        },
      },
    }),
  }),
});
