/**
 * E2E Test: Real-time Update — File change triggers UI update without refresh
 *
 * Verifies:
 * - WebSocket connection is established
 * - Modifying execution.json externally triggers a WebSocket event
 * - UI receives the update (toast notification) without page refresh
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { createTestProject, startTestServer, stopTestServer, cleanupTestProject } = require('./setup');

let projectPath;
let serverInfo;

test.beforeAll(async () => {
    projectPath = createTestProject();
    serverInfo = await startTestServer(projectPath);
});

test.afterAll(async () => {
    await stopTestServer(serverInfo.server);
    cleanupTestProject(projectPath);
});

test.describe('Real-time Update', () => {
    test('should receive WebSocket update when execution.json changes externally', async ({ page }) => {
        // Navigate to project view via dashboard to establish WebSocket connection
        await page.goto(serverInfo.baseURL);
        await expect(page.locator('h2').first()).toHaveText('Projects');
        await page.locator('.card').first().click();

        // Wait for task cards to load
        await expect(page.locator('.card-title').filter({ hasText: 'TASK1' })).toBeVisible();

        // Wait for WebSocket connection to establish and chokidar to settle
        await expect(page.locator('.connected')).toBeVisible({ timeout: 5000 });
        await page.waitForTimeout(1500);

        // Externally modify TASK1's execution.json
        const executionPath = path.join(
            projectPath, '.claudiomiro', 'task-executor', 'TASK1', 'execution.json',
        );
        const execution = JSON.parse(fs.readFileSync(executionPath, 'utf-8'));
        execution.status = 'completed';
        execution.completion = { status: 'completed', summary: ['Done via E2E test'] };
        fs.writeFileSync(executionPath, JSON.stringify(execution, null, 2));

        // Wait for toast notification — WebSocket broadcasts task:status and frontend shows toast
        await expect(page.locator('.toast').filter({ hasText: /TASK1.*status updated/ }))
            .toBeVisible({ timeout: 10000 });
    });
});
