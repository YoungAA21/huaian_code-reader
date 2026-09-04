import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.huaian.readermonitor',
  appName: '读码器状态监测',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
};

export default config;
