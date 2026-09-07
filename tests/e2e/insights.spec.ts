import { expect, test } from '@playwright/test'

test('insight panels render from the demo and follow the selected period', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Explore the demo' }).click()

  // Overview: week in review and recovery mix.
  await expect(
    page.getByRole('heading', { name: 'Week in review', exact: true }),
  ).toBeVisible()
  await expect(page.locator('.review-list li')).toHaveCount(5)
  await expect(
    page.getByRole('heading', { name: 'Recovery, day by day', exact: true }),
  ).toBeVisible()
  await expect(page.locator('button.heat-cell')).toHaveCount(30)
  await expect(page.locator('.heat-cell[data-selected]')).toHaveCount(1)
  const dayTrigger = page.getByRole('button', {
    name: /Select physiological day/,
  })
  const before = (await dayTrigger.textContent()) ?? ''
  await page.locator('button.heat-cell').first().click()
  await expect(dayTrigger).not.toHaveText(before)
  await page.getByRole('button', { name: 'Latest', exact: true }).click()

  // Recovery: grouped averages with three buckets per driver.
  await page.getByRole('button', { name: 'Recovery', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'What moves your recovery' }),
  ).toBeVisible()
  await expect(page.locator('.buckets li')).toHaveCount(6)
  await expect(
    page.getByRole('heading', { name: 'Recovery by weekday', exact: true }),
  ).toBeVisible()
  await expect(page.locator('.weekday')).toHaveCount(14)
  await page.getByRole('tab', { name: '7 days', exact: true }).click()
  await expect(page.locator('.weekday')).toHaveCount(0)
  await expect(page.getByText(/Weekday patterns need/).first()).toBeVisible()
  await page.getByRole('tab', { name: '30 days', exact: true }).click()

  // Sleep: one timing row per night in the range, selected night marked.
  await page.getByRole('button', { name: 'Sleep', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Sleep timing', exact: true }),
  ).toBeVisible()
  await expect(page.locator('.timing-row')).toHaveCount(30)
  await expect(page.locator('.timing-row[data-selected]')).toHaveCount(1)
  await expect(
    page.getByRole('heading', { name: 'Time asleep by weekday', exact: true }),
  ).toBeVisible()
  await page.getByRole('tab', { name: '7 days', exact: true }).click()
  await expect(page.locator('.timing-row')).toHaveCount(7)
  await page.getByRole('tab', { name: '30 days', exact: true }).click()

  // Activity: training load label and by-sport table.
  await page.getByRole('button', { name: 'Activity', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Training load', exact: true }),
  ).toBeVisible()
  await expect(page.locator('.load-trend')).toHaveText(
    /Steady|Ramping up|Backing off/,
  )
  await expect(
    page.getByRole('heading', { name: 'By sport', exact: true }),
  ).toBeVisible()
  await expect(page.locator('.sport-table tbody tr')).toHaveCount(3)
  expect(errors).toEqual([])
})
