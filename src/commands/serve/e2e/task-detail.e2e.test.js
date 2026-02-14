/**
 * E2E Test: Task Detail — View all 4 tabs
 *
 * Verifies:
 * - Task detail page loads with correct task ID
 * - All 4 tabs are visible: Overview, Blueprint, Execution, Review
 * - Switching tabs shows the correct content
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

/**
 * Navigate to a task detail page by clicking through the UI
 */
async function navigateToTask(page, baseURL, taskId) {
    await page.goto(baseURL);
    await expect(page.locator('h2').first()).toHaveText('Projects');
    await page.locator('.card').first().click();
    await expect(page.locator('.card-title').filter({ hasText: taskId })).toBeVisible();
    await page.locator(`a[href*="task/${taskId}"]`).click();
}

test.describe('Task Detail', () => {
    test('should show task detail with 4 tabs', async ({ page }) => {
        await navigateToTask(page, serverInfo.baseURL, 'TASK0');

        // Wait for task view to load — verify tabs appear
        await expect(page.locator('.tab')).toHaveCount(4);

        // Verify all 4 tabs are visible
        const tabs = page.locator('.tab');
        await expect(tabs.nth(0)).toHaveText('Overview');
        await expect(tabs.nth(1)).toHaveText('Blueprint');
        await expect(tabs.nth(2)).toHaveText('Execution');
        await expect(tabs.nth(3)).toHaveText('Review');
    });

    test('should show overview tab content by default', async ({ page }) => {
        await navigateToTask(page, serverInfo.baseURL, 'TASK0');

        // Wait for tabs to load
        await expect(page.locator('.tab')).toHaveCount(4);

        // Overview tab should be active
        await expect(page.locator('.tab.active')).toHaveText('Overview');

        // Status card should be visible in overview
        await expect(page.locator('.card-title').filter({ hasText: 'Status' })).toBeVisible();
    });

    test('should switch to blueprint tab and show content', async ({ page }) => {
        await navigateToTask(page, serverInfo.baseURL, 'TASK0');

        // Wait for tabs to load
        await expect(page.locator('.tab')).toHaveCount(4);

        // Click Blueprint tab
        await page.locator('.tab').filter({ hasText: 'Blueprint' }).click();

        // Verify blueprint editor is visible
        await expect(page.locator('.editor')).toBeVisible();

        // Wait for blueprint content to load asynchronously
        await expect(page.locator('textarea')).toHaveValue(/BLUEPRINT: TASK0/, { timeout: 10000 });
    });

    test('should switch to execution tab and show phases', async ({ page }) => {
        await navigateToTask(page, serverInfo.baseURL, 'TASK0');

        // Wait for tabs to load
        await expect(page.locator('.tab')).toHaveCount(4);

        // Click Execution tab
        await page.locator('.tab').filter({ hasText: 'Execution' }).click();

        // Verify phases card is visible
        await expect(page.locator('.card-title').filter({ hasText: 'Phases' })).toBeVisible();
    });

    test('should switch to review tab', async ({ page }) => {
        // Use TASK1 which HAS a CODE_REVIEW.md, so the review content loads
        await navigateToTask(page, serverInfo.baseURL, 'TASK1');

        // Wait for tabs to load
        await expect(page.locator('.tab')).toHaveCount(4);

        // Click Review tab
        await page.locator('.tab').filter({ hasText: 'Review' }).click();

        // TASK1 has a CODE_REVIEW.md — verify the review section is visible
        await expect(page.locator('h3').filter({ hasText: 'Code Review' })).toBeVisible({ timeout: 10000 });
    });
});
