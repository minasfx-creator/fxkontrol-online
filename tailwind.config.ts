import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans: ['Rajdhani', 'Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Rajdhani', 'Outfit', 'sans-serif'],
        tech: ['Rajdhani', 'Space Grotesk', 'Inter', 'sans-serif'],
        tactical: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        electric: {
          DEFAULT: "hsl(var(--electric))",
          glow: "hsl(var(--electric-glow))",
        },
        safety: {
          DEFAULT: "hsl(var(--safety))",
          glow: "hsl(var(--safety-glow))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: "hsl(var(--warning))",
        surface: {
          0: "hsl(var(--surface-0))",
          1: "hsl(var(--surface-1))",
          2: "hsl(var(--surface-2))",
          3: "hsl(var(--surface-3))",
          4: "hsl(var(--surface-4))",
        },
        fxk: {
          cyan: "hsl(var(--fxk-cyan))",
          orange: "hsl(var(--fxk-orange))",
          gold: "hsl(var(--fxk-gold))",
          violet: "hsl(var(--fxk-violet))",
          magenta: "hsl(var(--fxk-magenta))",
          red: "hsl(var(--fxk-red))",
          blue: "hsl(var(--fxk-blue))",
          green: "hsl(var(--fxk-green))",
          indigo: "hsl(var(--fxk-indigo))",
          phosphor: "hsl(var(--fxk-phosphor))",
          amber: "hsl(var(--fxk-amber))",
        },
        // Semantic aliases — Mission Control palette as named intent.
        // Use these in components instead of raw `text-cyan-400` etc. so the
        // design system is centralized and the visual language is stable.
        fx: {
          cyan:    "hsl(var(--fxk-cyan))",
          success: "hsl(var(--fxk-green))",
          warning: "hsl(var(--fxk-amber))",
          danger:  "hsl(var(--fxk-red))",
          info:    "hsl(var(--fxk-blue))",
          accent:  "hsl(var(--fxk-violet))",
        },
        // ── FXKONTROL Design System v1 (additive, opt-in) ──
        // Use `bg-ds-surface-panel`, `text-segment-pyro`, `text-status-sync`
        // in NEW components. Legacy components keep using `primary`/`fxk-*`.
        ds: {
          background:         "hsl(var(--ds-background))",
          "surface-deep":     "hsl(var(--ds-surface-deep))",
          "surface-panel":    "hsl(var(--ds-surface-panel))",
          "surface-elevated": "hsl(var(--ds-surface-elevated))",
          "border-default":   "hsl(var(--ds-border-default))",
          "border-subtle":    "hsl(var(--ds-border-subtle))",
          "border-active":    "hsl(var(--ds-border-active))",
          "text-primary":     "hsl(var(--ds-text-primary))",
          "text-secondary":   "hsl(var(--ds-text-secondary))",
          "text-muted":       "hsl(var(--ds-text-muted))",
          "text-disabled":    "hsl(var(--ds-text-disabled))",
        },
        segment: {
          pyro:   "hsl(var(--segment-pyro))",
          sfx:    "hsl(var(--segment-sfx))",
          drones: "hsl(var(--segment-drones))",
          light:  "hsl(var(--segment-light))",
          dmx:    "hsl(var(--segment-dmx))",
        },
        status: {
          ok:       "hsl(var(--status-ok))",
          sync:     "hsl(var(--status-sync))",
          warn:     "hsl(var(--status-warn))",
          fail:     "hsl(var(--status-fail))",
          disabled: "hsl(var(--status-disabled))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // ── Apple semantic radius scale ──
        // Use these in chrome (Dock, Header, Sidebar, popovers) instead of
        // ad-hoc `rounded-xl` / `rounded-2xl`. Concentric rule: outer radius
        // should be ≥ inner radius + padding (e.g. dock with `radius-island`
        // 16px and `p-2` 8px → items use `radius-control` 8px so corners
        // stay parallel).
        control: "var(--radius-control)", // 8px  — buttons, chips, inputs
        panel:   "var(--radius-panel)",   // 12px — cards, popovers, tooltips
        island:  "var(--radius-island)",  // 16px — dock, sidebar items
        sheet:   "var(--radius-sheet)",   // 20px — modals, sheets
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0, 0.55, 0.45, 1)',
        'expo-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      transitionDuration: {
        '600': '600ms',
        '1000': '1000ms',
        '1200': '1200ms',
        '2000': '2000ms',
        '2500': '2500ms',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-out": {
          "0%": { opacity: "1", transform: "translateY(0)" },
          "100%": { opacity: "0", transform: "translateY(10px)" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "fade-in": "fade-in 0.4s cubic-bezier(0.16,1,0.3,1)",
        "fade-out": "fade-out 0.3s ease-out",
        "scale-in": "scale-in 0.3s cubic-bezier(0.16,1,0.3,1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
