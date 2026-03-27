import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      react: path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
    },
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          'three-core': ['three'],
          'r3f': ['@react-three/fiber', '@react-three/drei'],
          'postprocessing': ['@react-three/postprocessing'],
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
        },
      },
    },
  },
  optimizeDeps: {
    include: ['three', '@react-three/fiber', '@react-three/drei'],
  },
}));
