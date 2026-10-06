import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.pokesleep.ast',
  appName: '宝睡小助手',
  webDir: 'dist',
  plugins: {
    SystemBars: { insetsHandling: 'css', style: 'DARK', initialViewportFitValueHint: 'cover' },
  },
}

export default config
