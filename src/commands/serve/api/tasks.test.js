const { createTasksRouter } = require('./tasks');
const fs = require('fs');

// Mock fs module
jest.mock('fs');

describe('tasks API router', () => {
    let router;
    let mockReq;
    let mockRes;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Create router
        router = createTasksRouter();

        // Mock request object
        mockReq = {
            params: {},
            body: {},
            headers: {
                'content-type': 'application/json',
                'transfer-encoding': 'chunked',
            },
            get: jest.fn((header) => mockReq.headers[header.toLowerCase()]),
        };

        // Mock response object
        mockRes = {
            json: jest.fn().mockReturnThis(),
            status: jest.fn().mockReturnThis(),
        };

        // Mock fs functions (default behaviors)
        fs.existsSync = jest.fn().mockReturnValue(false);
        fs.readdirSync = jest.fn().mockReturnValue([]);
        fs.statSync = jest.fn().mockReturnValue({ isDirectory: () => false });
        fs.readFileSync = jest.fn().mockReturnValue('{}');
        fs.writeFileSync = jest.fn();
        fs.appendFileSync = jest.fn();
        fs.mkdirSync = jest.fn();
    });

    describe('GET / - List tasks', () => {
        test('should return empty array when task-executor directory does not exist', () => {
            mockReq.params = { projectPath: '/test/project' };
            fs.existsSync.mockReturnValue(false);

            const handler = router.stack.find(layer =>
                layer.route && layer.route.path === '/' && layer.route.methods.get,
            ).route.stack[0].handle;

            handler(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data: [],
            });
        });

        test('should list tasks with status and dependencies', () => {
            mockReq.params = { projectPath: '/test/project' };

            fs.existsSync.mockImplementation((filePath) => {
                return filePath.includes('task-executor') ||
                       filePath.includes('TASK0') ||
                       filePath.includes('TASK1');
            });

            fs.readdirSync.mockReturnValue(['TASK0', 'TASK1', 'other-dir']);

            fs.statSync.mockImplementation((filePath) => ({
                isDirectory: () => filePath.includes('TASK'),
            }));

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('execution.json')) {
                    return JSON.stringify({
                        status: 'completed',
                        title: 'Test Task',
                    });
                }
                if (filePath.includes('BLUEPRINT.md')) {
                    return '@dependencies [TASK0]';
                }
                return '';
            });

            const handler = router.stack.find(layer =>
                layer.route && layer.route.path === '/' && layer.route.methods.get,
            ).route.stack[0].handle;

            handler(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data: expect.arrayContaining([
                    expect.objectContaining({
                        id: 'TASK0',
                        title: 'Test Task',
                        status: 'completed',
                        dependencies: ['TASK0'],
                    }),
                ]),
            });
        });

        test('should handle invalid execution.json gracefully', () => {
            mockReq.params = { projectPath: '/test/project' };

            fs.existsSync.mockReturnValue(true);
            fs.readdirSync.mockReturnValue(['TASK0']);
            fs.statSync.mockReturnValue({ isDirectory: () => true });
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('execution.json')) {
                    return 'invalid json';
                }
                return '';
            });

            const handler = router.stack.find(layer =>
                layer.route && layer.route.path === '/' && layer.route.methods.get,
            ).route.stack[0].handle;

            handler(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data: expect.arrayContaining([
                    expect.objectContaining({
                        id: 'TASK0',
                        status: 'pending',
                        dependencies: [],
                    }),
                ]),
            });
        });
    });

    describe('GET /:taskId - Full task details', () => {
        test('should return 404 for non-existent task', () => {
            mockReq.params = { projectPath: '/test/project', taskId: 'TASK999' };
            fs.existsSync.mockReturnValue(false);

            const handler = router.stack.find(layer =>
                layer.route && layer.route.path === '/:taskId' && layer.route.methods.get,
            ).route.stack[0].handle;

            handler(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Task not found: TASK999',
            });
        });

        test('should return full task details when all files exist', () => {
            mockReq.params = { projectPath: '/test/project', taskId: 'TASK0' };

            fs.existsSync.mockImplementation((filePath) => {
                return filePath.includes('TASK0');
            });

            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) {
                    return '# Blueprint content';
                }
                if (filePath.includes('execution.json')) {
                    return JSON.stringify({ status: 'completed' });
                }
                if (filePath.includes('CODE_REVIEW.md')) {
                    return '# Review content';
                }
                return '';
            });

            const handler = router.stack.find(layer =>
                layer.route && layer.route.path === '/:taskId' && layer.route.methods.get,
            ).route.stack[0].handle;

            handler(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data: {
                    id: 'TASK0',
                    blueprint: '# Blueprint content',
                    execution: { status: 'completed' },
                    review: '# Review content',
                },
            });
        });

        test('should handle missing files with null values', () => {
            mockReq.params = { projectPath: '/test/project', taskId: 'TASK0' };

            fs.existsSync.mockImplementation((filePath) => {
                return filePath.includes('TASK0') && !filePath.includes('.md') && !filePath.includes('.json');
            });

            const handler = router.stack.find(layer =>
                layer.route && layer.route.path === '/:taskId' && layer.route.methods.get,
            ).route.stack[0].handle;

            handler(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data: {
                    id: 'TASK0',
                    blueprint: null,
                    execution: null,
                    review: null,
                },
            });
        });
    });

    describe('GET /:taskId/blueprint', () => {
        test('should return 404 when BLUEPRINT.md not found', () => {
            mockReq.params = { projectPath: '/test/project', taskId: 'TASK0' };
            fs.existsSync.mockReturnValue(false);

            const handler = router.stack.find(layer =>
                layer.route && layer.route.path === '/:taskId/blueprint' && layer.route.methods.get,
            ).route.stack[0].handle;

            handler(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'BLUEPRINT.md not found for task: TASK0',
            });
        });

        test('should return blueprint content when file exists', () => {
            mockReq.params = { projectPath: '/test/project', taskId: 'TASK0' };
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('# Blueprint content');

            const handler = router.stack.find(layer =>
                layer.route && layer.route.path === '/:taskId/blueprint' && layer.route.methods.get,
            ).route.stack[0].handle;

            handler(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data: { content: '# Blueprint content' },
            });
        });
    });

    describe('GET /:taskId/execution', () => {
        test('should return 404 when execution.json not found', () => {
            mockReq.params = { projectPath: '/test/project', taskId: 'TASK0' };
            fs.existsSync.mockReturnValue(false);

            const handler = router.stack.find(layer =>
                layer.route && layer.route.path === '/:taskId/execution' && layer.route.methods.get,
            ).route.stack[0].handle;

            handler(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'execution.json not found for task: TASK0',
            });
        });

        test('should return parsed execution when valid JSON', () => {
            mockReq.params = { projectPath: '/test/project', taskId: 'TASK0' };
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({ status: 'completed' }));

            const handler = router.stack.find(layer =>
                layer.route && layer.route.path === '/:taskId/execution' && layer.route.methods.get,
            ).route.stack[0].handle;

            handler(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data: { status: 'completed' },
            });
        });

        test('should return 400 when execution.json is invalid JSON', () => {
            mockReq.params = { projectPath: '/test/project', taskId: 'TASK0' };
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('invalid json');

            const handler = router.stack.find(layer =>
                layer.route && layer.route.path === '/:taskId/execution' && layer.route.methods.get,
            ).route.stack[0].handle;

            handler(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: expect.stringContaining('Invalid JSON'),
            });
        });
    });

    describe('GET /:taskId/review', () => {
        test('should return both review files when they exist', () => {
            mockReq.params = { projectPath: '/test/project', taskId: 'TASK0' };
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('CODE_REVIEW.md')) {
                    return '# Review';
                }
                if (filePath.includes('REVIEW_CHECKLIST.md')) {
                    return '# Checklist';
                }
                return '';
            });

            const handler = router.stack.find(layer =>
                layer.route && layer.route.path === '/:taskId/review' && layer.route.methods.get,
            ).route.stack[0].handle;

            handler(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data: {
                    codeReview: '# Review',
                    reviewChecklist: '# Checklist',
                },
            });
        });

        test('should handle missing review files with null values', () => {
            mockReq.params = { projectPath: '/test/project', taskId: 'TASK0' };
            fs.existsSync.mockReturnValue(false);

            const handler = router.stack.find(layer =>
                layer.route && layer.route.path === '/:taskId/review' && layer.route.methods.get,
            ).route.stack[0].handle;

            handler(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data: {
                    codeReview: null,
                    reviewChecklist: null,
                },
            });
        });
    });

    describe('PUT /:taskId/blueprint', () => {
        test('should return 400 when content is missing', () => {
            mockReq.params = { projectPath: '/test/project', taskId: 'TASK0' };
            mockReq.body = {};

            const handler = router.stack.find(layer =>
                layer.route && layer.route.path === '/:taskId/blueprint' && layer.route.methods.put,
            ).route.stack[1].handle;

            handler(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Content must be a non-empty string',
            });
        });

        test('should write content and create directory if needed', () => {
            mockReq.params = { projectPath: '/test/project', taskId: 'TASK0' };
            mockReq.body = { content: '# New content' };
            fs.existsSync.mockReturnValue(false);

            const handler = router.stack.find(layer =>
                layer.route && layer.route.path === '/:taskId/blueprint' && layer.route.methods.put,
            ).route.stack[1].handle;

            handler(mockReq, mockRes);

            expect(fs.mkdirSync).toHaveBeenCalled();
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('BLUEPRINT.md'),
                '# New content',
                'utf-8',
            );
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data: { message: 'BLUEPRINT.md updated successfully' },
            });
        });
    });

    describe('PUT /:taskId/execution', () => {
        test('should return 400 when body is not an object', () => {
            mockReq.params = { projectPath: '/test/project', taskId: 'TASK0' };
            mockReq.body = 'not an object';

            const handler = router.stack.find(layer =>
                layer.route && layer.route.path === '/:taskId/execution' && layer.route.methods.put,
            ).route.stack[1].handle;

            handler(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Body must be a valid JSON object',
            });
        });

        test('should return 400 when required fields are missing', () => {
            mockReq.params = { projectPath: '/test/project', taskId: 'TASK0' };
            mockReq.body = { status: 'completed' };

            const handler = router.stack.find(layer =>
                layer.route && layer.route.path === '/:taskId/execution' && layer.route.methods.put,
            ).route.stack[1].handle;

            handler(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Missing required fields: status, task, title',
            });
        });

        test('should write valid execution.json', () => {
            mockReq.params = { projectPath: '/test/project', taskId: 'TASK0' };
            mockReq.body = { status: 'completed', task: 'TASK0', title: 'Test' };
            fs.existsSync.mockReturnValue(true);

            const handler = router.stack.find(layer =>
                layer.route && layer.route.path === '/:taskId/execution' && layer.route.methods.put,
            ).route.stack[1].handle;

            handler(mockReq, mockRes);

            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('execution.json'),
                expect.stringContaining('"status": "completed"'),
                'utf-8',
            );
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data: { message: 'execution.json updated successfully' },
            });
        });
    });

    describe('POST /:taskId/retry', () => {
        test('should return 404 when execution.json not found', () => {
            mockReq.params = { projectPath: '/test/project', taskId: 'TASK0' };
            fs.existsSync.mockReturnValue(false);

            const handler = router.stack.find(layer =>
                layer.route && layer.route.path === '/:taskId/retry' && layer.route.methods.post,
            ).route.stack[0].handle;

            handler(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'execution.json not found for task: TASK0',
            });
        });

        test('should reset status to pending and increment attempts', () => {
            mockReq.params = { projectPath: '/test/project', taskId: 'TASK0' };
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({
                status: 'completed',
                attempts: 1,
                errorHistory: ['error1'],
            }));

            const handler = router.stack.find(layer =>
                layer.route && layer.route.path === '/:taskId/retry' && layer.route.methods.post,
            ).route.stack[0].handle;

            handler(mockReq, mockRes);

            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('execution.json'),
                expect.stringContaining('"status": "pending"'),
                'utf-8',
            );

            const writtenContent = fs.writeFileSync.mock.calls[0][1];
            const parsed = JSON.parse(writtenContent);
            expect(parsed.attempts).toBe(2);
            expect(parsed.errorHistory).toEqual([]);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data: { message: 'Task reset to pending for retry', attempts: 2 },
            });
        });
    });

    describe('POST /:taskId/approve-review', () => {
        test('should return 404 when CODE_REVIEW.md not found', () => {
            mockReq.params = { projectPath: '/test/project', taskId: 'TASK0' };
            fs.existsSync.mockReturnValue(false);

            const handler = router.stack.find(layer =>
                layer.route && layer.route.path === '/:taskId/approve-review' && layer.route.methods.post,
            ).route.stack[0].handle;

            handler(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'CODE_REVIEW.md not found for task: TASK0',
            });
        });

        test('should append approval marker to CODE_REVIEW.md', () => {
            mockReq.params = { projectPath: '/test/project', taskId: 'TASK0' };
            fs.existsSync.mockReturnValue(true);

            const handler = router.stack.find(layer =>
                layer.route && layer.route.path === '/:taskId/approve-review' && layer.route.methods.post,
            ).route.stack[0].handle;

            handler(mockReq, mockRes);

            expect(fs.appendFileSync).toHaveBeenCalledWith(
                expect.stringContaining('CODE_REVIEW.md'),
                '\n\n## Status\n\nAPPROVED\n',
                'utf-8',
            );
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data: { message: 'Code review approved successfully' },
            });
        });
    });

    describe('taskId validation', () => {
        test('should reject invalid taskId format via regex', () => {
            const isValidTaskId = (taskId) => {
                return /^TASK\d+(\.\d+)?$|^TASKΩ$/.test(taskId);
            };

            expect(isValidTaskId('invalid-id')).toBe(false);
            expect(isValidTaskId('task0')).toBe(false);
            expect(isValidTaskId('../TASK0')).toBe(false);
            expect(isValidTaskId('TASK')).toBe(false);
        });

        test('should accept valid TASK0 format', () => {
            const isValidTaskId = (taskId) => {
                return /^TASK\d+(\.\d+)?$|^TASKΩ$/.test(taskId);
            };

            expect(isValidTaskId('TASK0')).toBe(true);
        });

        test('should accept valid TASK1.2 format', () => {
            const isValidTaskId = (taskId) => {
                return /^TASK\d+(\.\d+)?$|^TASKΩ$/.test(taskId);
            };

            expect(isValidTaskId('TASK1.2')).toBe(true);
            expect(isValidTaskId('TASK10.5')).toBe(true);
        });

        test('should accept valid TASKΩ format', () => {
            const isValidTaskId = (taskId) => {
                return /^TASK\d+(\.\d+)?$|^TASKΩ$/.test(taskId);
            };

            expect(isValidTaskId('TASKΩ')).toBe(true);
        });
    });
});
