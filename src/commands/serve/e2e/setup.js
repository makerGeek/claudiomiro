/**
 * E2E Test Setup Helpers
 * Provides server start/stop, temp project directory creation, and cleanup
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { createServer, startServer } = require('../server');

/**
 * Create a temporary project directory with sample tasks
 * @returns {string} Path to the temp project directory
 */
const createTestProject = () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudiomiro-e2e-'));
    const taskExecutorDir = path.join(tmpDir, '.claudiomiro', 'task-executor');
    fs.mkdirSync(taskExecutorDir, { recursive: true });

    // Create TASK0 — completed task
    const task0Dir = path.join(taskExecutorDir, 'TASK0');
    fs.mkdirSync(task0Dir, { recursive: true });
    fs.writeFileSync(
        path.join(task0Dir, 'execution.json'),
        JSON.stringify({
            $schema: 'execution-schema-v1',
            version: '1.0',
            task: 'TASK0',
            title: 'Task Decomposition',
            status: 'completed',
            started: '2025-01-01T00:00:00.000Z',
            attempts: 1,
            currentPhase: { id: 1, name: 'Preparation', lastAction: 'Completed' },
            phases: [
                {
                    id: 1,
                    name: 'Preparation',
                    status: 'completed',
                    items: [
                        { description: 'Read context', completed: true, evidence: 'Done' },
                    ],
                },
            ],
            artifacts: [
                { type: 'created', path: 'src/index.js', verified: true },
            ],
            uncertainties: [],
            beyondTheBasics: {
                cleanup: {
                    debugLogsRemoved: true,
                    formattingConsistent: true,
                    deadCodeRemoved: true,
                },
            },
            completion: {
                status: 'completed',
                summary: ['Created task decomposition module'],
                deviations: [],
                forFutureTasks: [],
            },
        }, null, 2),
    );
    fs.writeFileSync(
        path.join(task0Dir, 'BLUEPRINT.md'),
        '@dependencies []\n@difficulty easy\n\n# BLUEPRINT: TASK0\n\n## 1. IDENTITY\nTask Decomposition module\n',
    );

    // Create TASK1 — failed task (for retry testing)
    const task1Dir = path.join(taskExecutorDir, 'TASK1');
    fs.mkdirSync(task1Dir, { recursive: true });
    fs.writeFileSync(
        path.join(task1Dir, 'execution.json'),
        JSON.stringify({
            $schema: 'execution-schema-v1',
            version: '1.0',
            task: 'TASK1',
            title: 'Implementation Phase 1',
            status: 'failed',
            started: '2025-01-01T00:00:00.000Z',
            attempts: 2,
            currentPhase: { id: 2, name: 'Core Implementation', lastAction: 'Failed' },
            phases: [
                {
                    id: 1,
                    name: 'Preparation',
                    status: 'completed',
                    items: [
                        { description: 'Read context', completed: true, evidence: 'Done' },
                    ],
                },
                {
                    id: 2,
                    name: 'Core Implementation',
                    status: 'in_progress',
                    items: [
                        { description: 'Implement handler', completed: false },
                    ],
                },
            ],
            artifacts: [],
            uncertainties: [],
            errorHistory: [
                {
                    timestamp: '2025-01-01T01:00:00.000Z',
                    message: 'Build failed: missing dependency',
                },
            ],
            completion: {
                status: 'failed',
                summary: [],
                deviations: [],
            },
        }, null, 2),
    );
    fs.writeFileSync(
        path.join(task1Dir, 'BLUEPRINT.md'),
        '@dependencies [TASK0]\n@difficulty medium\n\n# BLUEPRINT: TASK1\n\n## 1. IDENTITY\nImplementation Phase 1\n',
    );
    fs.writeFileSync(
        path.join(task1Dir, 'CODE_REVIEW.md'),
        '# Code Review\n\nReview content for TASK1\n',
    );

    // Create AI_PROMPT.md (for edit-prompt testing)
    fs.writeFileSync(
        path.join(taskExecutorDir, 'AI_PROMPT.md'),
        '# AI Prompt\n\nOriginal prompt content for testing.\n',
    );

    return tmpDir;
};

/**
 * Start the server with a test project
 * @param {string} projectPath - Path to the test project
 * @returns {Promise<{server: Object, port: number, baseURL: string}>}
 */
const startTestServer = async (projectPath) => {
    const server = createServer({
        port: 0, // OS assigns random port
        host: 'localhost',
        projectPaths: [projectPath],
    });

    await startServer(server);
    const port = server.httpServer.address().port;

    return {
        server,
        port,
        baseURL: `http://localhost:${port}`,
    };
};

/**
 * Stop the test server and clean up
 * @param {Object} server - Server object from createServer()
 */
const stopTestServer = async (server) => {
    if (!server) return;

    if (server.wsHandler) {
        server.wsHandler.shutdown();
    }

    if (server.httpServer && server.httpServer.listening) {
        await new Promise((resolve) => {
            server.httpServer.close(resolve);
        });
    }
};

/**
 * Remove a temp project directory
 * @param {string} projectPath - Path to clean up
 */
const cleanupTestProject = (projectPath) => {
    if (projectPath && fs.existsSync(projectPath)) {
        fs.rmSync(projectPath, { recursive: true, force: true });
    }
};

module.exports = {
    createTestProject,
    startTestServer,
    stopTestServer,
    cleanupTestProject,
};
