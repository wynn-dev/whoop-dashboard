import { expect, test } from '@playwright/test'
import { demoDashboard } from '../../src/lib/demo'

test('Health Monitor exposes all five readings, gap-aware charts and stable personal comparisons', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Explore the demo' }).click()
  await page.getByRole('button', { name: 'Health', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Health Monitor', exact: true }),
  ).toBeVisible()
  await expect(page.locator('.health-card')).toHaveCount(5)
  await expect(page.locator('[data-health-band]')).toBeVisible()
  const path = await page.locator('[data-health-line]').getAttribute('d')
  expect((path?.match(/M/g) ?? []).length).toBeGreaterThan(1)
  const originalMedian = await page
    .locator('.health-context .detail-list')
    .textContent()
  await page.getByRole('tab', { name: '7 days', exact: true }).click()
  await expect(page.locator('.health-context .detail-list')).toHaveText(
    originalMedian!,
  )
  await page.getByRole('tab', { name: '30 days', exact: true }).click()
  for (const name of [
    'Resting heart rate',
    'Respiratory rate',
    'Blood oxygen',
    'Skin temperature',
  ]) {
    await page.locator('.health-card').filter({ hasText: name }).click()
    await expect(page.locator('#health-detail h3')).toHaveText(name)
    await expect(page.locator('[data-health-line]')).toBeVisible()
  }
  // A physiological range should be visible, not flattened against a zero axis.
  const bandHeight = await page
    .locator('[data-health-band]')
    .evaluate((el) => el.getBoundingClientRect().height)
  expect(bandHeight).toBeGreaterThan(20)
  await expect(page.locator('.health-temperature-delta')).toContainText(
    '°C from median',
  )
  await page.locator('.health-readings summary').click()
  await expect(page.locator('.health-readings tbody tr')).toHaveCount(30)
  await page.locator('.health-readings summary').click()
  await page.getByRole('link', { name: 'How comparisons work' }).click()
  await expect(page.locator('#health-method')).toHaveAttribute('open', '')
  await expect(page.getByText(/10th–90th percentile/)).toBeVisible()
  await page.locator('#health-method summary').click()
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({
    path: 'artifacts/health-desktop.png',
    fullPage: true,
    animations: 'disabled',
  })
  expect(errors).toEqual([])
})

test('sleep and activity details preserve the calendar and follow the selected day', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Explore the demo' }).click()
  await page.getByRole('button', { name: 'Sleep', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Why this much sleep?' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Sleep continuity' }),
  ).toBeVisible()
  await expect(page.locator('.sleep-need-list')).toContainText('−0h 12m')
  await expect(page.locator('.nap-row')).toHaveCount(1)
  await page.locator('.nap-row summary').click()
  await expect(page.locator('.nap-row .detail-stats')).toContainText('0h 00m')
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect(page.locator('.primary-trend svg path').first()).toBeVisible()
  await expect(
    page.locator('.sleep-bars svg rect[fill="#ddd3ed"]').first(),
  ).toBeVisible()
  await page.screenshot({
    path: 'artifacts/sleep-details-desktop.png',
    fullPage: true,
    animations: 'disabled',
  })
  await page.getByRole('button', { name: 'Previous day', exact: true }).click()
  await expect(page.getByText('No naps recorded for this day.')).toBeVisible()
  await page.getByRole('button', { name: 'Latest', exact: true }).click()
  await page.getByRole('button', { name: 'Activity', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Heart rate across your day' }),
  ).toBeVisible()
  const selected = page.locator('.panel').filter({
    has: page.getByRole('heading', { name: 'Selected-day activities' }),
  })
  await selected.locator('.workout summary').click()
  await expect(selected.locator('.zone-list li')).toHaveCount(6)
  await expect(selected.getByText('99.6%', { exact: true })).toBeVisible()
  await expect(selected.getByText('48 m', { exact: true })).toBeVisible()
  await expect(selected.getByText('−7 m', { exact: true })).toBeVisible()
  const history = page.locator('.panel').filter({
    has: page.getByRole('heading', { name: 'Activities', exact: true }),
  })
  await expect(history.locator('.workout')).toHaveCount(6)
  await history.getByRole('button', { name: 'Show 6 more' }).click()
  await expect(history.locator('.workout')).toHaveCount(12)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({
    path: 'artifacts/workout-details-desktop.png',
    fullPage: true,
    animations: 'disabled',
  })
  await page.getByRole('button', { name: 'Previous day', exact: true }).click()
  await page.getByRole('button', { name: 'Previous day', exact: true }).click()
  await expect(
    selected.getByText('Recorded workouts will appear here.'),
  ).toBeVisible()
})

test('health, naps, zones and tables fit a narrow screen and remain keyboard accessible', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Explore the demo' }).click()
  for (const section of ['Health', 'Sleep', 'Activity']) {
    await page.getByRole('button', { name: section, exact: true }).click()
    if (section === 'Health') {
      const card = page
        .locator('.health-card')
        .filter({ hasText: 'Blood oxygen' })
      await card.focus()
      await page.keyboard.press('Enter')
      await expect(card).toHaveAttribute('aria-pressed', 'true')
      await page.screenshot({
        path: 'artifacts/health-mobile.png',
        fullPage: true,
        animations: 'disabled',
      })
      await page.locator('.health-readings summary').click()
      await expect(
        page.getByRole('region', { name: 'Blood oxygen readings table' }),
      ).toHaveAttribute('tabindex', '0')
    }
    if (section === 'Activity') {
      await page.locator('.workout summary').first().click()
      await expect(page.locator('.zone-list').first()).toBeVisible()
      await page.screenshot({
        path: 'artifacts/workout-mobile.png',
        fullPage: true,
        animations: 'disabled',
      })
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false)
  }
})

test('missing fields and calibrating records are not shown as normal or zero', async ({
  page,
}) => {
  const data = demoDashboard()
  data.syncedAt = new Date().toISOString()
  for (const record of data.records)
    if (record.kind === 'recovery' && record.data.score) {
      record.data.score.user_calibrating = true
      delete record.data.score.spo2_percentage
    }
  await page.route('**/api/dashboard', (route) => route.fulfill({ json: data }))
  await page.goto('/')
  await page.getByRole('button', { name: 'Health', exact: true }).click()
  const hrv = page.locator('.health-card').filter({ hasText: 'HRV' })
  await expect(hrv).toContainText('WHOOP calibrating')
  await expect(page.locator('.health-context')).toContainText(
    'not used for a FORM comparison',
  )
  const oxygen = page
    .locator('.health-card')
    .filter({ hasText: 'Blood oxygen' })
  await expect(oxygen).toContainText('No reading')
  await oxygen.click()
  await expect(page.locator('.chart-empty')).toContainText(
    'No readings in this period',
  )
  await expect(page.locator('.health-context')).toContainText(
    'Missing does not mean zero',
  )
  await page
    .locator('.health-card')
    .filter({ hasText: 'Respiratory rate' })
    .click()
  await expect(page.locator('.health-context .detail-list')).toBeVisible()
})
