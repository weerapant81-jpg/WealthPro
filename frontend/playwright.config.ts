import { defineConfig, devices } from '@playwright/test'

// E2E smoke tests — เฉพาะหน้าสาธารณะ (ไม่ต้องล็อกอิน/ไม่แตะฐานข้อมูลจริง) จึงรันใน CI ได้โดยไม่ต้องมี backend
// Playwright สั่ง build + preview เองผ่าน webServer แล้วยิงเทสต์เข้า preview
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
