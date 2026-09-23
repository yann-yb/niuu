import { expect, test } from '@playwright/test';

test('relay opens as a Volundr-backed mission-control board', async ({ page }) => {
  await page.goto('/volundr/relay');

  await expect(page.getByTestId('relay-page')).toBeVisible({ timeout: 8_000 });
  await expect(page.getByRole('heading', { name: 'Jobs' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Mission lanes' })).toBeVisible();
  await expect(page.getByTestId('relay-lane-attention')).toBeVisible();
  await expect(page.getByTestId('relay-lane-active')).toBeVisible();
});

test('relay is available from the Volundr tab bar', async ({ page }) => {
  await page.goto('/volundr/forge');
  const relayTab = page.getByRole('button', { name: 'Relay', exact: true });
  await expect(relayTab).toBeVisible();
  await relayTab.click();
  await expect(page).toHaveURL(/\/volundr\/relay$/);
});
