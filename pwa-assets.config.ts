import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Generates the PWA / home-screen icons from public/favicon.svg.
// Re-run after changing the favicon: `bun run icons`
// The favicon already has its own felt tile, so home-screen icons use it edge to edge.
const fullBleed = { padding: 0, resizeOptions: { background: '#0b2219', fit: 'contain' } } as const

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, ...fullBleed },
    apple: { ...minimal2023Preset.apple, ...fullBleed },
  },
  images: ['public/favicon.svg'],
})
