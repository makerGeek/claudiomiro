/**
 * E2E Test: Edit AI_PROMPT.md — Modify, save, verify persistence
 *
 * Verifies:
 * - Can navigate to the blueprint editor
 * - Can modify content in the editor
 * - Save button becomes enabled when content changes
 * - After saving, reloading shows the updated content
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

test.describe('Edit Prompt (Blueprint)', () => {
    test('should edit blueprint, save, and verify persistence', async ({ page }) => {
        await navigateToTask(page, serverInfo.baseURL, 'TASK0');

        // Wait for task view tabs to load
        await expect(page.locator('.tab')).toHaveCount(4);

        // Navigate to Blueprint tab
        await page.locator('.tab').filter({ hasText: 'Blueprint' }).click();

        // Wait for editor to load
        await expect(page.locator('.editor')).toBeVisible();
        const textarea = page.locator('textarea');
        await expect(textarea).toBeVisible();

        // Save button should be disabled initially (no changes)
        const saveBtn = page.locator('.btn-primary').filter({ hasText: /Save/ });
        await expect(saveBtn).toBeDisabled();

        // Modify content
        await textarea.fill('# Updated BLUEPRINT\n\nNew content added via E2E test');

        // Save button should now be enabled
        await expect(saveBtn).toBeEnabled();

        // Click save
        await saveBtn.click();

        // Verify success toast appears
        await expect(page.locator('.toast').filter({ hasText: 'saved' })).toBeVisible({ timeout: 5000 });

        // Reload and navigate back to verify persistence
        await navigateToTask(page, serverInfo.baseURL, 'TASK0');
        await expect(page.locator('.tab')).toHaveCount(4);
        await page.locator('.tab').filter({ hasText: 'Blueprint' }).click();

        // Verify the updated content is shown
        await expect(page.locator('textarea')).toHaveValue(/Updated BLUEPRINT/);
    });
});
