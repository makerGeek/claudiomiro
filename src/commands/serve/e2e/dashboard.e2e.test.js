/**
 * E2E Test: Dashboard — View project list
 *
 * Verifies:
 * - Dashboard loads and shows project cards
 * - Project card displays project name and task count
 * - Clicking project card navigates to project view with task list
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

test.describe('Dashboard', () => {
    test('should load dashboard and show project card', async ({ page }) => {
        await page.goto(serverInfo.baseURL);

        // Wait for dashboard to render
        await expect(page.locator('h2')).toHaveText('Projects');

        // Verify project card is visible
        const card = page.locator('.card').first();
        await expect(card).toBeVisible();

        // Verify card shows task count
        await expect(card).toContainText('tasks');
    });

    test('should navigate to project view when clicking project card', async ({ page }) => {
        await page.goto(serverInfo.baseURL);

        // Wait for project card to be visible
        const card = page.locator('.card').first();
        await expect(card).toBeVisible();

        // Click the project card
        await card.click();

        // Verify navigation to project view — hash should contain /project/
        await expect(page).toHaveURL(/.*#\/project\//);

        // Verify task list is visible with task cards
        await expect(page.locator('.card-title').filter({ hasText: 'TASK0' })).toBeVisible();
        await expect(page.locator('.card-title').filter({ hasText: 'TASK1' })).toBeVisible();
    });
});
