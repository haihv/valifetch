import { copyFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vitepress';
import apiSidebar from '../api/typedoc-sidebar.json';

const repo = 'https://github.com/haihv/valifetch';

export default defineConfig({
  title: 'valifetch',
  description:
    'Type-safe HTTP client built on native fetch with Valibot schema validation.',
  lang: 'en-US',
  base: '/valifetch/',
  cleanUrls: true,
  lastUpdated: true,
  head: [['meta', { name: 'theme-color', content: '#3c8772' }]],

  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started', activeMatch: '/guide/' },
      { text: 'Recipes', link: '/recipes/auth', activeMatch: '/recipes/' },
      {
        text: 'Migration',
        link: '/migration/from-ky',
        activeMatch: '/migration/',
      },
      { text: 'API', link: '/api/', activeMatch: '/api/' },
      {
        text: 'Links',
        items: [
          { text: 'Changelog', link: `${repo}/blob/main/CHANGELOG.md` },
          { text: 'npm', link: 'https://www.npmjs.com/package/valifetch' },
          { text: 'JSR', link: 'https://jsr.io/@haihv/valifetch' },
        ],
      },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Getting started', link: '/guide/getting-started' },
            { text: 'Instances', link: '/guide/instances' },
          ],
        },
        {
          text: 'Making requests',
          items: [
            { text: 'Requests', link: '/guide/requests' },
            { text: 'Validation', link: '/guide/validation' },
            { text: 'Responses', link: '/guide/responses' },
            { text: 'Errors', link: '/guide/errors' },
            { text: 'Retry', link: '/guide/retry' },
            { text: 'Hooks', link: '/guide/hooks' },
            { text: 'Debug mode', link: '/guide/debug' },
          ],
        },
        {
          text: 'Reference',
          items: [
            { text: 'TypeScript', link: '/guide/typescript' },
            {
              text: 'Subpath imports & tree-shaking',
              link: '/guide/subpath-imports',
            },
            {
              text: 'API design decisions',
              link: '/guide/api-design-decisions',
            },
            { text: 'Performance', link: '/guide/performance' },
          ],
        },
        {
          text: 'Project',
          items: [
            { text: 'Versioning & stability', link: '/guide/versioning' },
            { text: 'Security', link: '/guide/security' },
          ],
        },
      ],
      '/recipes/': [
        {
          text: 'Recipes',
          items: [
            { text: 'Authentication', link: '/recipes/auth' },
            { text: 'SSE and AI streaming', link: '/recipes/sse-streaming' },
            { text: 'Mocking in tests', link: '/recipes/testing' },
            { text: 'Pagination', link: '/recipes/pagination' },
            { text: 'Parallel requests', link: '/recipes/parallel-requests' },
            { text: 'File upload', link: '/recipes/file-upload' },
          ],
        },
      ],
      '/migration/': [
        {
          text: 'Migration',
          items: [
            { text: 'From ky', link: '/migration/from-ky' },
            { text: 'From axios', link: '/migration/from-axios' },
          ],
        },
      ],
      '/api/': [{ text: 'API reference', link: '/api/' }, ...apiSidebar],
    },

    socialLinks: [{ icon: 'github', link: repo }],

    search: { provider: 'local' },

    editLink: {
      pattern: `${repo}/edit/main/docs/:path`,
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright (c) haihv',
    },
  },

  // Expose the agent-facing summary at <base>/llms.txt.
  buildEnd: ({ outDir }) => {
    copyFileSync(
      path.resolve(import.meta.dirname, '../../llms.txt'),
      path.join(outDir, 'llms.txt')
    );
  },
});
