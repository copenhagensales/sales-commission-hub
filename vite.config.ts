import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import legacy from "@vitejs/plugin-legacy";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    // Ældre TV-browsere (fx Samsung Tizen 5 / Chromium 63) får en separat legacy-bundle med polyfills.
    mode !== "development" && legacy({ targets: ["chrome >= 63"], modernPolyfills: false }),
    mode === "development" && componentTagger(),
    // PWA: kun app-skallen precaches. Data (Supabase/edge/auth) er altid NetworkOnly.
    // Registrering sker kun via src/lib/pwa/registerServiceWorker.ts (aldrig i dev/preview).
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      devOptions: { enabled: false },
      filename: "sw.js",
      manifest: {
        id: "/",
        name: "Stork",
        short_name: "Stork",
        description: "Copenhagen Sales – provision, mål og opstart",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait-primary",
        theme_color: "#2e3136",
        background_color: "#e6f0f1",
        lang: "da",
        icons: [
          { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/pwa/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Ingen cachet HTML-fallback: navigationer går altid til nettet; offline vises offline.html.
        navigateFallback: null,
        globPatterns: ["**/*.{js,css,woff,woff2,ttf,png,svg,ico,webmanifest}", "offline.html"],
        globIgnores: ["**/index.html", "images/**", "brand/**", "**/*-legacy*", "**/polyfills-*"],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        runtimeCaching: [
          {
            // Backend, edge functions og auth: aldrig cache.
            urlPattern: ({ url }) =>
              url.hostname.endsWith(".supabase.co") ||
              url.hostname.endsWith(".supabase.in") ||
              url.pathname.startsWith("/functions/") ||
              url.pathname.startsWith("/auth/v1") ||
              url.pathname.startsWith("/rest/v1") ||
              url.pathname.startsWith("/api") ||
              url.pathname.startsWith("/~oauth"),
            handler: "NetworkOnly",
          },
          {
            // Sidenavigation: altid netværk; ved offline vises den statiske offline-side.
            urlPattern: ({ request, url }) => request.mode === "navigate" && !url.pathname.startsWith("/~oauth") && !url.pathname.startsWith("/auth"),
            handler: "NetworkOnly",
            options: {
              plugins: [
                {
                  // Kører i service workeren (ikke i Node), derfor globalThis-opslag.
                  handlerDidError: async () =>
                    (await (globalThis as unknown as { caches: { match: (url: string, opts?: { ignoreSearch?: boolean }) => Promise<Response | undefined> } }).caches.match("/offline.html", { ignoreSearch: true })) || Response.error(),
                },
              ],
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-twilio': ['@twilio/voice-sdk'],
          'vendor-recharts': ['recharts'],
          'vendor-tiptap': [
            '@tiptap/react',
            '@tiptap/starter-kit',
            '@tiptap/extension-placeholder',
            '@tiptap/extension-table',
            '@tiptap/extension-table-cell',
            '@tiptap/extension-table-header',
            '@tiptap/extension-table-row',
            '@tiptap/extension-text-align',
            '@tiptap/extension-underline',
          ],
          'vendor-xlsx': ['exceljs'],
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
        },
      },
    },
  },
}));
