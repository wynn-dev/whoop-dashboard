import { expect, test } from '@playwright/test'

test('private routes reject unauthenticated and cross-origin requests', async ({
  request,
}) => {
  expect((await request.get('/api/dashboard')).status()).toBe(401)
  expect(
    (
      await request.post('/api/sync', {
        headers: { origin: 'https://untrusted.example' },
      })
    ).status(),
  ).toBe(403)
  expect(
    (
      await request.post('/api/auth/logout', {
        headers: { origin: 'https://untrusted.example' },
      })
    ).status(),
  ).toBe(403)
  const invalidCallback = await request.get(
    '/api/auth/whoop/callback?code=invalid&state=forged',
    { maxRedirects: 0 },
  )
  expect(invalidCallback.status()).toBe(302)
  expect(invalidCallback.headers().location).toBe('/?auth_error=invalid_state')
})

test('OAuth requests offline access and binds the callback to a secure state cookie', async ({
  request,
}) => {
  const response = await request.get('/api/auth/whoop', { maxRedirects: 0 })
  expect(response.status()).toBe(302)
  const location = new URL(response.headers().location)
  expect(location.origin).toBe('https://api.prod.whoop.com')
  expect(location.searchParams.get('scope')?.split(' ')).toContain('offline')
  expect(location.searchParams.get('state')?.length).toBeGreaterThanOrEqual(32)
  expect(response.headers()['set-cookie']).toContain('HttpOnly')
  expect(response.headers()['set-cookie']).toMatch(/SameSite=Lax/i)
})

test('demo charts, date ranges, navigation, and daily values work on desktop', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: /signals clearly/ }),
  ).toBeVisible()
  await page.screenshot({
    path: 'artifacts/welcome-desktop.png',
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Explore the demo' }).click()
  await expect(page.getByText('Demo data', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Recovery', exact: true }),
  ).toBeVisible()
  await expect(page.locator('.primary-trend svg path').first()).toBeVisible()
  await page.getByRole('tab', { name: '7 days', exact: true }).click()
  await expect(page.getByText('7 physiological days recorded')).toBeVisible()
  const selected = await page
    .getByRole('combobox', { name: 'Select physiological day' })
    .inputValue()
  await page.getByRole('button', { name: 'Previous day', exact: true }).click()
  await expect(
    page.getByRole('combobox', { name: 'Select physiological day' }),
  ).not.toHaveValue(selected)
  await page.getByRole('button', { name: 'Next day', exact: true }).click()
  await expect(
    page.getByRole('combobox', { name: 'Select physiological day' }),
  ).toHaveValue(selected)
  await page.keyboard.press('ArrowLeft')
  await expect(
    page.getByRole('combobox', { name: 'Select physiological day' }),
  ).not.toHaveValue(selected)
  await expect(page.getByRole('button', { name: 'Latest' })).toBeVisible()
  await page.getByRole('button', { name: 'Latest' }).click()
  await expect(page.getByText('Today', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Sleep', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Sleep quality', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Last night', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('meter', { name: 'Sleep need met' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Activity', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Daily strain', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Recovery', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Heart rate variability', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Overview', exact: true }).click()
  await page.getByRole('tab', { name: '30 days', exact: true }).click()
  await page.locator('.daily-table summary').click()
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.locator('.daily-table tbody tr')).toHaveCount(30)
  await page.locator('.daily-table summary').click()
  const barsStayInsideChart = await page
    .locator('.sleep-bars svg.overflow-visible')
    .evaluate((svg) => {
      const top = svg.getBoundingClientRect().top
      const bars = [...svg.querySelectorAll('rect[fill="#ddd3ed"]')]
      return (
        bars.length > 0 &&
        bars.every((bar) => bar.getBoundingClientRect().top >= top - 1)
      )
    })
  expect(barsStayInsideChart).toBe(true)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({
    path: 'artifacts/dashboard-desktop.png',
    fullPage: true,
    animations: 'disabled',
  })
  expect(errors).toEqual([])
})

test('mobile layout fits without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Explore the demo' }).click()
  await expect(page.getByText('Demo data', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Sleep', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Sleep quality', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Overview', exact: true }).click()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  )
  expect(overflow).toBe(false)
  await page.screenshot({
    path: 'artifacts/dashboard-mobile.png',
    fullPage: true,
    animations: 'disabled',
  })
})
