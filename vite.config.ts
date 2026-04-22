import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: { enabled: false },
      includeAssets: ["favicon.png", "pwa-icon-192.png", "pwa-icon-512.png"],
      manifest: {
        name: "FX KONTROL — Show Design Platform",
        short_name: "FX KONTROL",
        description: "Professional drone swarm & pyrotechnics show design platform by Minas FX.",
        theme_color: "#0a0c10",
        background_color: "#0a0c10",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        icons: [
          { src: "/pwa-icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        globIgnores: [
          "**/bundle-analysis.html",
          "**/lovable-uploads/**",
          "**/vendor-export-*.js",
          "**/ru-*.js",
          "**/postprocessing-core-*.js",
          "**/three-core-*.js",
          "**/r3f-*.js",
          "**/vendor-tiles-*.js",
          "**/vendor-markdown-*.js",
          "**/recharts-*.js",
          // Mermaid ecosystem — lazy-loaded, not needed in precache
          "**/mermaid*",
          "**/cytoscape*",
          "**/katex-*.js",
          "**/wardley-*.js",
          "**/cose-bilkent-*.js",
          "**/html2canvas*",
          "**/*Diagram-*.js",
          "**/layout-*.js",
          "**/vdlParser-*.js",
        ],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/~oauth/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api",
              expiration: { maxEntries: 50, maxAgeSeconds: 5 * 60 },
              cacheableResponse: { statuses: [0, 200] },
              networkTimeoutSeconds: 10,
            },
          },
          {
            urlPattern: /\/assets\/(three-core|r3f|ru-|postprocessing|vendor-export|vendor-tiles|recharts)/i,
            handler: "CacheFirst",
            options: {
              cacheName: "lazy-chunks",
              expiration: { maxEntries: 30, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
    mode === "production" && visualizer({
      filename: "dist/bundle-analysis.html",
      gzipSize: true,
      brotliSize: true,
      template: "treemap",
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      react: path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
    },
  },
  build: {
    // Broader target for Safari 15+, Firefox 91+, Chrome 91+
    target: ['es2020', 'safari15', 'firefox91', 'chrome91'],
    cssTarget: ['safari15', 'chrome91', 'firefox91'],
    // Smaller chunks = better caching & parallel loading
    chunkSizeWarningLimit: 600,
    cssCodeSplit: true,
    // Minification
    minify: 'esbuild',
    rollupOptions: {
      output: {
        // Stable chunk names for long-term caching
        chunkFileNames: 'assets/[name]-[hash:8].js',
        assetFileNames: 'assets/[name]-[hash:8][extname]',
        manualChunks(id) {
          // ── render_ultra subsystem splitting ──
          if (id.includes('render_ultra/fireworks/')) return 'ru-fireworks';
          if (id.includes('render_ultra/environment/')) return 'ru-environment';
          if (id.includes('render_ultra/lighting/')) return 'ru-lighting';
          if (id.includes('render_ultra/postprocessing/')) return 'ru-postprocess';
          if (id.includes('render_ultra/drones/')) return 'ru-drones';

          // ── vendor chunks ──
          const vendorChunks: Record<string, string[]> = {
            'three-core': ['three'],
            'r3f': ['@react-three/fiber', '@react-three/drei'],
            'postprocessing': ['@react-three/postprocessing'],
            'postprocessing-core': ['postprocessing'],
            'recharts': ['recharts'],
            'vendor-state': ['zustand', 'react-router-dom', 'sonner', '@tanstack/react-query'],
            'vendor-ui': [
              '@radix-ui/react-dialog', '@radix-ui/react-popover', '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-tabs', '@radix-ui/react-tooltip', '@radix-ui/react-select',
              '@radix-ui/react-accordion', '@radix-ui/react-slider',
              '@radix-ui/react-toast', '@radix-ui/react-switch', '@radix-ui/react-checkbox',
              '@radix-ui/react-radio-group', '@radix-ui/react-collapsible', '@radix-ui/react-scroll-area',
              '@radix-ui/react-context-menu', '@radix-ui/react-menubar', '@radix-ui/react-progress',
              '@radix-ui/react-separator', '@radix-ui/react-toggle', '@radix-ui/react-toggle-group',
              '@radix-ui/react-label', '@radix-ui/react-hover-card', '@radix-ui/react-alert-dialog',
              '@radix-ui/react-aspect-ratio', '@radix-ui/react-avatar', '@radix-ui/react-navigation-menu',
              '@radix-ui/react-slot',
            ],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
            'vendor-misc': ['date-fns', 'cmdk', 'input-otp', 'embla-carousel-react', 'react-day-picker', 'vaul', 'react-resizable-panels', 'tus-js-client', 'react-window', 'next-themes'],
            'vendor-export': ['jspdf', 'docx', 'jszip'],
            'vendor-tiles': ['3d-tiles-renderer'],
            'vendor-capacitor': ['@capacitor/core', '@capacitor/haptics'],
            'vendor-markdown': ['react-markdown'],
            'vendor-icons': ['lucide-react'],
          };
          for (const [chunk, pkgs] of Object.entries(vendorChunks)) {
            if (pkgs.some(pkg => id.includes(`node_modules/${pkg}`))) return chunk;
          }
        },
      },
    },
  },
  optimizeDeps: {
    include: ['three', '@react-three/fiber', '@react-three/drei'],
  },
}));
