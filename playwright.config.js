// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: 'src/commands/serve/e2e',
    testMatch: '*.e2e.test.js',
    timeout: 30000,
    retries: 0,
    workers: 1,
    use: {
        browserName: 'chromium',
        headless: true,
        baseURL: process.env.BASE_URL || 'http://localhost:3000',
    },
    projects: [
        {
            name: 'chromium',
            use: { browserName: 'chromium' },
        },
    ],
});
