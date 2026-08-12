import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
    });
    page.__xIsasErrors = errors;

    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-fixture-ready', 'true');
});

test.afterEach(async ({ page }) => {
    expect(page.__xIsasErrors).toEqual([]);
});

test('@all opens native surfaces, restores focus, and adapts presentation', async ({ page }) => {
    const dropdownTrigger = page.getByTestId('dropdown-trigger');
    const dropdown = page.locator('#actions');
    await dropdownTrigger.focus();
    await page.keyboard.press('Enter');
    await expect(dropdown).toHaveAttribute('data-isas-presentation', 'dropdown');
    await expect(dropdown).toBeVisible();
    await page.getByTestId('dropdown-close').click();
    await expect(dropdown).toBeHidden();

    const dialogTrigger = page.getByTestId('dialog-trigger');
    await dialogTrigger.click();
    await expect(page.locator('#settings')).toHaveJSProperty('open', true);
    await page.getByTestId('dialog-close').click();
    await expect(page.locator('#settings')).toHaveJSProperty('open', false);
    await expect(dialogTrigger).toBeFocused();

    const overlay = page.locator('#adaptive');
    await page.getByTestId('overlay-trigger').click();
    await expect(overlay).toHaveAttribute('data-isas-presentation', /dropdown|dialog/);
    await page.setViewportSize({ width: 600, height: 900 });
    await expect(overlay).toHaveAttribute('data-isas-presentation', 'dialog');
    await expect(overlay.getByLabel('Overlay query')).toHaveValue('stable');
});

test('preserves native form, OTP, and tabs semantics', async ({ page }) => {
    const otp = page.getByLabel('Verification code');
    await otp.fill('1234');
    await expect(page.getByTestId('completed')).toHaveText('1234');

    await page.getByTestId('native-form').getByRole('button', { name: 'Submit' }).click();
    await expect(page.getByTestId('submitted')).toHaveText('fixture@example.com');

    const tabs = page.getByTestId('tabs');
    await tabs.getByRole('tab', { name: 'Security' }).click();
    await expect(page.getByTestId('tab-value')).toHaveText('security');
    await expect(tabs.getByRole('tabpanel', { name: 'Security' })).toBeVisible();
});

test('runs calendar and native file selection in a real browser', async ({ page }) => {
    await expect(page.getByTestId('calendar-value')).toHaveText('2026-08-12');
    const day = page.getByRole('button', { name: /August 20, 2026/i });
    await day.click();
    await expect(page.getByTestId('calendar-value')).toHaveText('2026-08-20');

    const native = page.getByTestId('file-upload').locator('input[type="file"]');
    await native.setInputFiles({
        name: 'contract.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('x-isas'),
    });
    await expect(page.getByTestId('file-upload')).toContainText('contract.txt');
});
