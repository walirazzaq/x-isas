import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/browser/standalone',
    globalSetup: './tests/browser/standalone/global-setup.js',
    timeout: 30_000,
    outputDir: './test-results/standalone',
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    reporter: [['list']],
    use: {
        baseURL: 'http://127.0.0.1:4173',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'standalone-desktop',
            use: {
                ...devices['Desktop Chrome'],
                viewport: { width: 1440, height: 1000 },
            },
        },
        {
            name: 'standalone-mobile',
            use: devices['Pixel 7'],
            grep: /@mobile|@all/,
        },
    ],
});
