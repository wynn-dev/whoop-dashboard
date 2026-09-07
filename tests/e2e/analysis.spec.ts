import { expect, test } from '@playwright/test'

test('the Insights tab shows gated, explained analysis panels', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Explore the demo' }).click()
  await page.getByRole('button', { name: 'Insights', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Insights', exact: true }),
  ).toBeVisible()
  for (const name of [
    'How your days relate',
    'Unusual nights',
    'HRV readiness',
    'Month against month',
    'Day-to-day stability',
    'Sleep balance',
    'Sleep architecture',
    'Regularity and social jetlag',
    'Naps and the next morning',
    'Bouncing back',
    'Hard days in a row',
    'Weekly monotony',
    'Time in heart-rate zones',
    'The morning after, by sport',
    'Evening sessions',
    'Highlights',
    'Data coverage',
  ]) {
    await expect(
      page.getByRole('heading', { name, exact: true }).first(),
    ).toBeVisible()
  }
  // Relationships need 20 paired days: present at 30 days, absent at 7.
  await expect(page.locator('.relationship')).not.toHaveCount(0)
  await expect(page.locator('.ci')).not.toHaveCount(0)
  // The demo has one night with several signals moving together.
  await expect(page.locator('.nights li')).toHaveCount(1)
  await expect(page.locator('.nights .chip')).not.toHaveCount(0)
  // HRV readiness renders the band chart from 90 days of demo history.
  await expect(page.locator('[data-health-band]')).toBeVisible()
  await expect(page.locator('[data-health-line]')).toBeVisible()
  // Every panel explains itself.
  const methods = page.locator('.method')
  expect(await methods.count()).toBeGreaterThanOrEqual(15)
  await methods.first().locator('summary').click()
  await expect(methods.first()).toHaveAttribute('open', '')
  await expect(methods.first()).toContainText('Spearman')

  await page.getByRole('tab', { name: '7 days', exact: true }).click()
  await expect(page.locator('.relationship')).toHaveCount(0)
  await expect(page.getByText(/needs at least 20 days/i)).toBeVisible()
  await page.getByRole('tab', { name: '90 days', exact: true }).click()
  await expect(page.locator('.relationship')).not.toHaveCount(0)
  expect(errors).toEqual([])
})

test('Insights fit a phone without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Explore the demo' }).click()
  await page.getByRole('button', { name: 'Insights', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'How your days relate', exact: true }),
  ).toBeVisible()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  )
  expect(overflow).toBe(false)
})
