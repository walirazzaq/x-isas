import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/browser/livewire',
    globalSetup: './tests/browser/livewire/global-setup.js',
    timeout: 40_000,
    outputDir: './test-results/livewire',
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    reporter: [['list']],
    use: {
        baseURL: 'http://127.0.0.1:4180',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'livewire-desktop',
            use: {
                ...devices['Desktop Chrome'],
                viewport: { width: 1440, height: 1000 },
            },
        },
        {
            name: 'livewire-mobile',
            use: devices['Pixel 7'],
            grep: /@mobile|@all/,
        },
    ],
});
