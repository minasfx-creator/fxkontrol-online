'use strict';

const THEMES = Object.freeze({
  dark: {
    id: 'dark',
    background: '#0B0F1A',
    surface: 'rgba(19, 25, 41, 0.62)',
    textPrimary: '#F5F7FF',
    textSecondary: '#A9B6D3',
    accent: '#6EA8FE',
    glassBlurPx: 16,
    shadow: '0 12px 40px rgba(0,0,0,.35)',
  },
  ultra_dark: {
    id: 'ultra_dark',
    background: '#030508',
    surface: 'rgba(9, 13, 22, 0.70)',
    textPrimary: '#EAF0FF',
    textSecondary: '#9AA8C8',
    accent: '#7F8CFF',
    glassBlurPx: 18,
    shadow: '0 14px 44px rgba(0,0,0,.45)',
  },
  high_contrast: {
    id: 'high_contrast',
    background: '#000000',
    surface: 'rgba(0, 0, 0, 0.86)',
    textPrimary: '#FFFFFF',
    textSecondary: '#E5E5E5',
    accent: '#FFD400',
    glassBlurPx: 10,
    shadow: '0 0 0 rgba(0,0,0,0)',
  },
});

class ThemeEngine {
  constructor(defaultTheme = 'dark') {
    this.currentThemeId = THEMES[defaultTheme] ? defaultTheme : 'dark';
  }

  setTheme(themeId) {
    if (!THEMES[themeId]) {
      throw new Error(`Theme inválido: ${themeId}`);
    }
    this.currentThemeId = themeId;
    return this.getTheme();
  }

  getTheme() {
    return { ...THEMES[this.currentThemeId] };
  }

  getCanvasOverlayStyle() {
    const theme = this.getTheme();
    return {
      backdropFilter: `blur(${theme.glassBlurPx}px)`,
      background: theme.surface,
      boxShadow: theme.shadow,
      border: `1px solid ${theme.textSecondary}33`,
      color: theme.textPrimary,
    };
  }
}

module.exports = {
  THEMES,
  ThemeEngine,
};
