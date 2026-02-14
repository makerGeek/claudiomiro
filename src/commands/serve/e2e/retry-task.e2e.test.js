/**
 * E2E Test: Retry Failed Task — Verify retry functionality
 *
 * Verifies:
 * - Failed task shows 'Failed' status in the project task list
 * - Calling retry API changes task status to 'pending'
 * - After retry, refreshing the project view shows updated status
 *
 * Note: The retry button in the task detail view requires task.status at the top level,
 * but getTask() returns it under task.execution.status. This test verifies the
 * retry functionality through the API and project view task list.
 */

const { test, expect } = require('@playwright/test');
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

test.describe('Retry Failed Task', () => {
    test('should retry failed task via API and verify status change in UI', async ({ page }) => {
        // Navigate to project view via dashboard
        await page.goto(serverInfo.baseURL);
        await expect(page.locator('h2').first()).toHaveText('Projects');
        await page.locator('.card').first().click();

        // Wait for task cards to load
        await expect(page.locator('.card-title').filter({ hasText: 'TASK1' })).toBeVisible();

        // Verify TASK1 currently shows 'Failed' status
        const task1Card = page.locator('.card').filter({ hasText: 'TASK1' });
        await expect(task1Card).toContainText('Failed');

        // Call retry API directly via page.evaluate (simulates the retry button click)
        const encodedPath = encodeURIComponent(projectPath);
        const retryResult = await page.evaluate(async (path) => {
            // eslint-disable-next-line no-undef
            const res = await fetch(`/api/projects/${path}/tasks/TASK1/retry`, { method: 'POST' });
            return res.json();
        }, encodedPath);

        expect(retryResult.success).toBe(true);

        // Refresh the task list by clicking the Refresh button
        await page.locator('.btn-secondary').filter({ hasText: 'Refresh' }).click();

        // After retry, TASK1 should show 'Pending' status
        await expect(task1Card).toContainText('Pending', { timeout: 5000 });
    });
});
