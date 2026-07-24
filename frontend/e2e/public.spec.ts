import { test, expect } from '@playwright/test'

// Smoke tests สำหรับหน้าสาธารณะ — ยืนยันว่าหน้าโหลดได้ เนื้อหาหลักอยู่ครบ และ flow เดินได้
// ไม่มีการล็อกอินหรือเรียก /api ที่ต้องมีข้อมูลจริง จึงรันได้แม้ไม่มี backend

test('หน้าแรก (landing) โหลดและมีปุ่มหลัก', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'ทดลองใช้ฟรี' }).first()).toBeVisible()
  // footer มีชื่อบริษัท + ช่องทางติดต่อ
  await expect(page.getByText('บริษัท อัลติเมทไลฟ์ แอ็ดไวเซอร์ จำกัด').first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'info@wealthpro.cloud' }).first()).toBeVisible()
})

test('เมนูนำทางไปหน้าฟีเจอร์ได้', async ({ page }) => {
  await page.goto('/')
  await page.getByText('ฟีเจอร์', { exact: true }).first().click()
  await expect(page).toHaveURL(/\/features$/)
  await expect(page.getByText('จบงานได้ในแอปเดียว')).toBeVisible()
})

test('หน้าฟีเจอร์: ปุ่มตัวอย่างรายงานชี้ไปไฟล์ PDF', async ({ page }) => {
  await page.goto('/features')
  const link = page.getByRole('link', { name: /ตัวอย่างรายงาน/ })
  await expect(link).toHaveAttribute('href', '/report-sample.pdf')
  await expect(link).toHaveAttribute('target', '_blank')
})

test('หน้าฟีเจอร์: carousel เปิดดูภาพเต็มจอได้', async ({ page }) => {
  await page.goto('/features')
  const slides = page.locator('img[alt^="ตัวอย่างหน้า"]')
  await expect(slides).toHaveCount(6)
  // ปุ่ม "ดูเต็มจอ" ของสไลด์ที่แสดงอยู่ → เปิด dialog
  await page.getByRole('button', { name: /ดูตัวอย่างหน้า.*เต็มจอ/ }).first().click()
  await expect(page.getByText(/^ตัวอย่างหน้า/).last()).toBeVisible()
  // ปิดด้วย Escape
  await page.keyboard.press('Escape')
})

test('หน้าเกี่ยวกับเรา: จำนวนลูกค้าและชื่อผู้ก่อตั้ง', async ({ page }) => {
  await page.goto('/about')
  await expect(page.getByText('1,277')).toBeVisible()
  await expect(page.getByText('ลูกค้าที่ดูแล')).toBeVisible()
  await expect(page.getByText('วีระพันธ์ เต็มดวง').first()).toBeVisible()
})

test('หน้าติดตั้ง iPad โหลดได้', async ({ page }) => {
  await page.goto('/install')
  await expect(page.locator('body')).toContainText('หน้าจอโฮม')
})

test('หน้านโยบายและข้อกำหนดโหลดได้', async ({ page }) => {
  await page.goto('/privacy')
  await expect(page.getByText('บริษัท อัลติเมทไลฟ์ แอ็ดไวเซอร์ จำกัด').first()).toBeVisible()
  await page.goto('/terms')
  await expect(page.locator('body')).toContainText('ข้อกำหนด')
})

test('หน้าเข้าสู่ระบบแสดงฟอร์ม', async ({ page }) => {
  await page.goto('/login')
  await expect(page.locator('input[type="email"]')).toBeVisible()
  await expect(page.locator('input[type="password"]')).toBeVisible()
})

test('CTA ทดลองใช้ฟรี พาไปหน้าสมัคร', async ({ page }) => {
  await page.goto('/login?mode=register')
  await expect(page.locator('input[type="email"]')).toBeVisible()
})
