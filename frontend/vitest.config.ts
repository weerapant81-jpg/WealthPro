import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

// รันเทสต์ทั้งของ frontend และของโมดูลกลาง shared/finance (ใช้ร่วมกับ backend)
export default mergeConfig(viteConfig, defineConfig({
  test: {
    include: ['src/**/*.test.ts', '../shared/**/*.test.ts'],
  },
}))
