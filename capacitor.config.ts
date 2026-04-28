import type { CapacitorConfig } from '@capacitor/cli';

/**
 * ─── Capacitor Config — FX KONTROL ─────────────────────────────────
 *
 * Native shell for iOS (and Android) used to access USB Serial,
 * BLE GATT, and other low-level hardware APIs that iOS Safari blocks
 * on the PWA.
 *
 * Hot-reload from Lovable sandbox is enabled via `server.url`.
 * Remove that block before submitting to App Store / Play Store.
 *
 * USB Serial on iPhone:
 *   • Native USB access requires a Capacitor plugin (e.g.
 *     `@adeunis/capacitor-serial` or `cordova-plugin-usbserial`).
 *   • Lightning / USB-C → USB-A adapter is required physically.
 *   • iOS apps must declare `MFi` accessory protocol strings in
 *     `ios/App/App/Info.plist` for whitelisted devices, OR use
 *     CDC-ACM class drivers via the Capacitor plugin.
 *   • See `docs/iphone-usb-serial.md` for the integration recipe.
 */
const config: CapacitorConfig = {
  appId: 'app.lovable.98b5e02e4ef047eeafa0148a304fb6c2',
  appName: 'fxkontrol-online',
  webDir: 'dist',
  server: {
    url: 'https://98b5e02e-4ef0-47ee-afa0-148a304fb6c2.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#050810', // Vantablack — matches Night Mode palette
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    backgroundColor: '#050810',
    allowMixedContent: true,
  },
};

export default config;
