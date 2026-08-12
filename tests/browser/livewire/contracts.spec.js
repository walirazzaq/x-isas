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
    await expect(page.getByTestId('contract-lab')).toHaveAttribute('wire:id', /.+/);
});

test.afterEach(async ({ page }) => {
    expect(page.__xIsasErrors).toEqual([]);
});

test('@all preserves keyed x-isas and Alpine identity through real Livewire morphs', async ({ page }) => {
    const lab = page.getByTestId('contract-lab');
    const stable = page.getByTestId('stable-alpine');
    const nested = page.getByTestId('nested-counter');

    expect(await nested.getAttribute('wire:id')).not.toBe(await lab.getAttribute('wire:id'));
    await stable.evaluate((element) => { globalThis.__xIsasStableButton = element; });
    await stable.click();
    await expect(stable).toContainText('Alpine 1');

    await page.getByTestId('server-morph').click();
    await expect(page.getByTestId('revision')).toHaveText('2');
    await expect(stable).toContainText('Alpine 1');
    expect(await stable.evaluate((element) => element === globalThis.__xIsasStableButton)).toBe(true);

    await page.getByTestId('nested-increment').click();
    await expect(page.getByTestId('nested-count')).toHaveText('1');
    await expect(page.getByTestId('revision')).toHaveText('2');
});

test('synchronizes generated input, select, and OTP controls with Livewire models', async ({ page }) => {
    await page.getByTestId('email-field').locator('[data-isas-input-native]')
        .fill('after@example.test');
    await expect(page.getByTestId('email-value')).toHaveText('after@example.test');

    await page.getByTestId('owner-field').locator('[data-isas-select-control]')
        .selectOption('grace', { force: true });
    await expect(page.getByTestId('owner-value')).toHaveText('grace');

    await page.getByTestId('otp').locator('[data-isas-otp-native]').fill('2468');
    await expect(page.getByTestId('code-value')).toHaveText('2468');
});

test('keeps a teleported native dialog operational and open during a parent morph', async ({ page }) => {
    const dialog = page.locator('#livewire-dialog');
    await page.getByTestId('dialog-trigger').click();
    await expect(dialog).toHaveJSProperty('open', true);
    await dialog.getByLabel('Dialog draft').fill('local draft');

    await page.getByTestId('dialog-morph').click();
    await expect(dialog).toHaveJSProperty('open', true);
    await expect(page.getByTestId('dialog-revision')).toHaveText('2');
    await expect(dialog.getByLabel('Dialog draft')).toHaveValue('local draft');

    await page.getByTestId('dialog-close').click();
    await expect(dialog).toHaveJSProperty('open', false);
});

test('uses the real Livewire upload transport behind the x-isas file control', async ({ page }) => {
    const upload = page.getByTestId('livewire-upload');
    await upload.locator('[data-isas-file-upload-native]').setInputFiles({
        name: 'livewire-contract.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('real Livewire upload'),
    });

    await expect(page.getByTestId('temporary-count')).toHaveText('1');
    await page.getByTestId('upload-lab').getByRole('button', { name: 'Save files' }).click();
    await expect(page.getByTestId('saved-files')).toHaveText('livewire-contract.txt');
});

test('@all reinitializes x-isas after wire:navigate page replacement', async ({ page }) => {
    await page.getByTestId('navigate-link').click();
    await expect(page).toHaveURL(/\/navigated$/);
    await expect(page.getByTestId('navigated-badge')).toHaveClass(/\bbadge-success\b/);

    await page.getByTestId('navigate-back').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('contract-lab')).toHaveAttribute('wire:id', /.+/);
    await expect(page.getByTestId('stable-alpine')).toHaveClass(/\bbtn\b/);
});
