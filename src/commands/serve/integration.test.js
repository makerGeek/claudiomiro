/**
 * Integration tests for the serve command
 * Tests full REST API contract and WebSocket communication
 * Uses supertest for HTTP and ws for WebSocket
 */

const request = require('supertest');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createServer, startServer: _startServer } = require('./server');

// Helpers for temp project setup
const createTempProject = () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudiomiro-test-'));
    const taskExecutorDir = path.join(tmpDir, '.claudiomiro', 'task-executor');
    fs.mkdirSync(taskExecutorDir, { recursive: true });
    return tmpDir;
};

const createTask = (projectDir, taskId, execution, blueprint = '') => {
    const taskDir = path.join(projectDir, '.claudiomiro', 'task-executor', taskId);
    fs.mkdirSync(taskDir, { recursive: true });

    if (execution) {
        fs.writeFileSync(
            path.join(taskDir, 'execution.json'),
            JSON.stringify(execution, null, 2),
        );
    }

    if (blueprint) {
        fs.writeFileSync(path.join(taskDir, 'BLUEPRINT.md'), blueprint);
    }
};

const removeTempDir = (dir) => {
    fs.rmSync(dir, { recursive: true, force: true });
};

describe('Integration Tests', () => {
    let projectDir;
    let server;
    let app;

    beforeEach(() => {
        projectDir = createTempProject();

        // Create sample tasks
        createTask(projectDir, 'TASK0', {
            $schema: 'execution-schema-v1',
            task: 'TASK0',
            title: 'Task Decomposition',
            status: 'completed',
            completion: { status: 'completed' },
        }, '@dependencies []\n@difficulty easy\n\n# BLUEPRINT: TASK0\n\nSample blueprint');

        createTask(projectDir, 'TASK1', {
            $schema: 'execution-schema-v1',
            task: 'TASK1',
            title: 'Implementation Phase 1',
            status: 'in_progress',
            currentPhase: { id: 2, name: 'Core', lastAction: 'Working' },
        }, '@dependencies [TASK0]\n@difficulty medium\n\n# BLUEPRINT: TASK1');

        server = createServer({
            port: 0, // Let OS assign port
            host: 'localhost',
            projectPaths: [projectDir],
        });

        app = server.app;
    });

    afterEach(async () => {
        // Shutdown WebSocket handler
        if (server.wsHandler) {
            server.wsHandler.shutdown();
        }

        // Close HTTP server if listening
        if (server.httpServer.listening) {
            await new Promise((resolve) => {
                server.httpServer.close(resolve);
            });
        }

        removeTempDir(projectDir);
    });

    describe('REST API — Projects', () => {
        test('GET /api/projects — returns project list', async () => {
            const res = await request(app).get('/api/projects');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeInstanceOf(Array);
            expect(res.body.data.length).toBe(1);
            expect(res.body.data[0].path).toBe(projectDir);
            expect(res.body.data[0].taskCount).toBe(2);
            expect(res.body.data[0].completedCount).toBe(1);
        });

        test('GET /api/projects/:path/state — returns project state', async () => {
            const encodedPath = encodeURIComponent(projectDir);
            const res = await request(app).get(`/api/projects/${encodedPath}/state`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.tasks).toBeInstanceOf(Array);
            expect(res.body.data.tasks.length).toBe(2);
            expect(res.body.data.summary.total).toBe(2);
            expect(res.body.data.summary.completed).toBe(1);
            expect(res.body.data.summary.inProgress).toBe(1);
        });

        test('GET /api/projects/:path/state — 400 for invalid path', async () => {
            const encodedPath = encodeURIComponent('/nonexistent/path');
            const res = await request(app).get(`/api/projects/${encodedPath}/state`);

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });

    describe('REST API — Tasks', () => {
        test('GET /api/projects/:path/tasks — returns task list', async () => {
            const encodedPath = encodeURIComponent(projectDir);
            const res = await request(app).get(`/api/projects/${encodedPath}/tasks`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeInstanceOf(Array);
            expect(res.body.data.length).toBe(2);
            expect(res.body.data[0].id).toBe('TASK0');
            expect(res.body.data[1].id).toBe('TASK1');
        });

        test('GET /api/projects/:path/tasks/:taskId — returns task detail', async () => {
            const encodedPath = encodeURIComponent(projectDir);
            const res = await request(app).get(`/api/projects/${encodedPath}/tasks/TASK0`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe('TASK0');
            expect(res.body.data.execution).toBeDefined();
            expect(res.body.data.execution.status).toBe('completed');
            expect(res.body.data.blueprint).toContain('BLUEPRINT: TASK0');
        });

        test('GET /api/projects/:path/tasks/:taskId — 404 for nonexistent task', async () => {
            const encodedPath = encodeURIComponent(projectDir);
            const res = await request(app).get(`/api/projects/${encodedPath}/tasks/TASK99`);

            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
        });

        test('GET /api/projects/:path/tasks/:taskId — 400 for invalid taskId', async () => {
            const encodedPath = encodeURIComponent(projectDir);
            const res = await request(app).get(`/api/projects/${encodedPath}/tasks/invalid-id`);

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });

        test('GET /api/projects/:path/tasks/:taskId/blueprint — returns blueprint content', async () => {
            const encodedPath = encodeURIComponent(projectDir);
            const res = await request(app).get(`/api/projects/${encodedPath}/tasks/TASK0/blueprint`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.content).toContain('BLUEPRINT: TASK0');
        });

        test('PUT /api/projects/:path/tasks/:taskId/blueprint — updates file', async () => {
            const encodedPath = encodeURIComponent(projectDir);
            const newContent = '# Updated BLUEPRINT\n\nNew content here';

            const res = await request(app)
                .put(`/api/projects/${encodedPath}/tasks/TASK0/blueprint`)
                .send({ content: newContent });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            // Verify file was actually updated
            const filePath = path.join(projectDir, '.claudiomiro', 'task-executor', 'TASK0', 'BLUEPRINT.md');
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            expect(fileContent).toBe(newContent);
        });

        test('PUT /api/projects/:path/tasks/:taskId/blueprint — 400 for empty content', async () => {
            const encodedPath = encodeURIComponent(projectDir);
            const res = await request(app)
                .put(`/api/projects/${encodedPath}/tasks/TASK0/blueprint`)
                .send({ content: '' });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });

        test('POST /api/projects/:path/tasks/:taskId/retry — resets task', async () => {
            const encodedPath = encodeURIComponent(projectDir);
            const res = await request(app)
                .post(`/api/projects/${encodedPath}/tasks/TASK1/retry`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            // Verify execution.json was updated
            const executionPath = path.join(projectDir, '.claudiomiro', 'task-executor', 'TASK1', 'execution.json');
            const execution = JSON.parse(fs.readFileSync(executionPath, 'utf-8'));
            expect(execution.status).toBe('pending');
        });

        test('POST /api/projects/:path/tasks/:taskId/retry — 404 for nonexistent task', async () => {
            const encodedPath = encodeURIComponent(projectDir);
            const res = await request(app)
                .post(`/api/projects/${encodedPath}/tasks/TASK99/retry`);

            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
        });
    });

    describe('REST API — Prompt', () => {
        test('GET /api/projects/:path/prompt — returns AI_PROMPT.md', async () => {
            // Create AI_PROMPT.md
            const promptPath = path.join(projectDir, '.claudiomiro', 'task-executor', 'AI_PROMPT.md');
            fs.writeFileSync(promptPath, '# AI Prompt\n\nPrompt content here');

            const encodedPath = encodeURIComponent(projectDir);
            const res = await request(app).get(`/api/projects/${encodedPath}/prompt`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.content).toContain('AI Prompt');
        });

        test('GET /api/projects/:path/prompt — 404 when no AI_PROMPT.md', async () => {
            const encodedPath = encodeURIComponent(projectDir);
            const res = await request(app).get(`/api/projects/${encodedPath}/prompt`);

            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
        });

        test('PUT /api/projects/:path/prompt — updates AI_PROMPT.md', async () => {
            const encodedPath = encodeURIComponent(projectDir);
            const newContent = '# Updated Prompt\n\nNew prompt content';

            const res = await request(app)
                .put(`/api/projects/${encodedPath}/prompt`)
                .send({ content: newContent });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            // Verify file was actually updated
            const promptPath = path.join(projectDir, '.claudiomiro', 'task-executor', 'AI_PROMPT.md');
            const fileContent = fs.readFileSync(promptPath, 'utf-8');
            expect(fileContent).toBe(newContent);
        });

        test('PUT /api/projects/:path/prompt — 400 for empty content', async () => {
            const encodedPath = encodeURIComponent(projectDir);
            const res = await request(app)
                .put(`/api/projects/${encodedPath}/prompt`)
                .send({ content: '' });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });

    describe('REST API — Logs', () => {
        test('GET /api/projects/:path/logs — returns empty when no log file', async () => {
            const encodedPath = encodeURIComponent(projectDir);
            const res = await request(app).get(`/api/projects/${encodedPath}/logs`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.content).toBe('');
        });

        test('GET /api/projects/:path/logs — returns log content', async () => {
            // Create log.txt
            const logDir = path.join(projectDir, '.claudiomiro');
            fs.writeFileSync(path.join(logDir, 'log.txt'), 'Line 1\nLine 2\nLine 3\n');

            const encodedPath = encodeURIComponent(projectDir);
            const res = await request(app).get(`/api/projects/${encodedPath}/logs`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.content).toContain('Line 1');
        });
    });

    describe('WebSocket Integration', () => {
        let httpServer;

        beforeEach((done) => {
            httpServer = server.httpServer;
            httpServer.listen(0, 'localhost', () => {
                done();
            });
        });

        test('should connect and receive initial project:state', (done) => {
            const port = httpServer.address().port;
            const encodedPath = encodeURIComponent(projectDir);
            const ws = new WebSocket(`ws://localhost:${port}?project=${encodedPath}`);

            ws.on('message', (data) => {
                const message = JSON.parse(data.toString());

                if (message.event === 'project:state') {
                    expect(message.data.projectPath).toBe(projectDir);
                    expect(message.data.tasks).toBeDefined();
                    expect(message.data.tasks.TASK0).toBeDefined();
                    expect(message.data.tasks.TASK0.status).toBe('completed');

                    ws.close();
                    done();
                }
            });

            ws.on('error', (err) => {
                done(err);
            });
        }, 10000);

        test('should receive error for invalid project path', (done) => {
            const port = httpServer.address().port;
            const ws = new WebSocket(`ws://localhost:${port}?project=${encodeURIComponent('/invalid/path')}`);

            ws.on('message', (data) => {
                const message = JSON.parse(data.toString());

                if (message.event === 'error') {
                    expect(message.data.message).toContain('Invalid project path');
                    ws.close();
                    done();
                }
            });

            ws.on('error', (err) => {
                done(err);
            });
        }, 10000);

        test('should broadcast file changes via WebSocket', (done) => {
            const port = httpServer.address().port;
            const encodedPath = encodeURIComponent(projectDir);
            const ws = new WebSocket(`ws://localhost:${port}?project=${encodedPath}`);
            let gotInitialState = false;
            let fileModified = false;

            ws.on('message', (data) => {
                const message = JSON.parse(data.toString());

                if (message.event === 'project:state') {
                    gotInitialState = true;

                    // Wait for chokidar to settle, then modify TASK1's execution.json
                    setTimeout(() => {
                        const executionPath = path.join(
                            projectDir, '.claudiomiro', 'task-executor', 'TASK1', 'execution.json',
                        );
                        const execution = JSON.parse(fs.readFileSync(executionPath, 'utf-8'));
                        execution.status = 'completed';
                        fs.writeFileSync(executionPath, JSON.stringify(execution, null, 2));
                        fileModified = true;
                    }, 500);
                }

                // Only match TASK1 status change after we modified the file
                if (message.event === 'task:status' && gotInitialState && fileModified
                    && message.data.taskId === 'TASK1') {
                    expect(message.data.status).toBe('completed');
                    ws.close();
                    done();
                }
            });

            ws.on('error', (err) => {
                done(err);
            });
        }, 15000);
    });

    describe('Static Files and SPA Fallback', () => {
        test('GET /index.html — serves static file', async () => {
            const res = await request(app).get('/index.html');

            // Should either serve the file or get a 404 if public/index.html doesn't exist in test context
            expect([200, 304]).toContain(res.status);
        });

        test('GET /nonexistent-route — SPA fallback serves index.html', async () => {
            const res = await request(app).get('/dashboard');

            // SPA fallback should serve index.html
            expect([200, 304]).toContain(res.status);
        });
    });

    describe('Error Handling', () => {
        test('GET /api/unknown — returns 404 via SPA fallback skip', async () => {
            const res = await request(app).get('/api/unknown');

            // API routes that don't match any router will get a 404 from Express
            expect(res.status).toBe(404);
        });
    });
});
