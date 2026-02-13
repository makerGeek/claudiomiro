/**
 * Tests for logs.js - Log Access API Router
 */

const { createLogsRouter } = require('./logs');
const fs = require('fs');

// Mock fs module
jest.mock('fs');

describe('createLogsRouter', () => {
    let router;

    beforeEach(() => {
        // Create router with empty options
        router = createLogsRouter({});

        // Clear all mocks
        jest.clearAllMocks();
    });

    describe('Router structure', () => {
        test('should create a valid Express router with GET route', () => {
            expect(router).toBeDefined();
            expect(router.stack).toBeDefined();

            const getRoute = router.stack.find(
                layer => layer.route && layer.route.methods.get,
            );

            expect(getRoute).toBeDefined();
        });
    });

    describe('GET handler', () => {
        test('returns recent log.txt content when file exists', () => {
            const projectPath = '/home/user/project';
            const logContent = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';

            fs.existsSync.mockReturnValueOnce(true);
            fs.readFileSync.mockReturnValueOnce(logContent);

            const req = {
                params: { projectPath },
                query: {},
            };

            const res = {
                json: jest.fn(),
            };

            const getHandler = router.stack.find(
                layer => layer.route && layer.route.methods.get,
            ).route.stack[0].handle;

            getHandler(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: {
                    content: logContent,
                    lines: 5,
                },
            });
        });

        test('returns empty logs when log.txt does not exist', () => {
            const projectPath = '/home/user/project';

            fs.existsSync.mockReturnValueOnce(false);

            const req = {
                params: { projectPath },
                query: {},
            };

            const res = {
                json: jest.fn(),
            };

            const getHandler = router.stack.find(
                layer => layer.route && layer.route.methods.get,
            ).route.stack[0].handle;

            getHandler(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: {
                    content: '',
                    lines: 0,
                },
            });
        });

        test('respects custom lines query parameter', () => {
            const projectPath = '/home/user/project';
            const logContent = Array.from({ length: 150 }, (_, i) => `Line ${i + 1}`).join('\n');

            fs.existsSync.mockReturnValueOnce(true);
            fs.readFileSync.mockReturnValueOnce(logContent);

            const req = {
                params: { projectPath },
                query: { lines: '30' },
            };

            const res = {
                json: jest.fn(),
            };

            const getHandler = router.stack.find(
                layer => layer.route && layer.route.methods.get,
            ).route.stack[0].handle;

            getHandler(req, res);

            const callArgs = res.json.mock.calls[0][0];
            expect(callArgs.success).toBe(true);
            expect(callArgs.data.lines).toBeLessThanOrEqual(30);
        });

        test('returns 400 when projectPath is missing', () => {
            const req = {
                params: {},
                query: {},
            };

            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            const getHandler = router.stack.find(
                layer => layer.route && layer.route.methods.get,
            ).route.stack[0].handle;

            getHandler(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Project path is required',
            });
        });

        test('uses default 100 lines when param is invalid', () => {
            const projectPath = '/home/user/project';
            const logContent = Array.from({ length: 200 }, (_, i) => `Line ${i + 1}`).join('\n');

            fs.existsSync.mockReturnValueOnce(true);
            fs.readFileSync.mockReturnValueOnce(logContent);

            const req = {
                params: { projectPath },
                query: { lines: 'invalid' },
            };

            const res = {
                json: jest.fn(),
            };

            const getHandler = router.stack.find(
                layer => layer.route && layer.route.methods.get,
            ).route.stack[0].handle;

            getHandler(req, res);

            const callArgs = res.json.mock.calls[0][0];
            expect(callArgs.success).toBe(true);
            expect(callArgs.data.lines).toBeLessThanOrEqual(100);
        });

        test('handles read errors gracefully', () => {
            const projectPath = '/home/user/project';

            fs.existsSync.mockReturnValueOnce(true);
            fs.readFileSync.mockImplementationOnce(() => {
                throw new Error('Permission denied');
            });

            const req = {
                params: { projectPath },
                query: {},
            };

            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            const getHandler = router.stack.find(
                layer => layer.route && layer.route.methods.get,
            ).route.stack[0].handle;

            getHandler(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Failed to read logs',
            });
        });

        test('correctly tails large log files', () => {
            const projectPath = '/home/user/project';
            const logContent = Array.from({ length: 500 }, (_, i) => `Line ${i + 1}`).join('\n');

            fs.existsSync.mockReturnValueOnce(true);
            fs.readFileSync.mockReturnValueOnce(logContent);

            const req = {
                params: { projectPath },
                query: { lines: '10' },
            };

            const res = {
                json: jest.fn(),
            };

            const getHandler = router.stack.find(
                layer => layer.route && layer.route.methods.get,
            ).route.stack[0].handle;

            getHandler(req, res);

            const callArgs = res.json.mock.calls[0][0];
            expect(callArgs.success).toBe(true);
            // Should get last 10 lines (491-500, since array is 0-indexed)
            expect(callArgs.data.content).toContain('Line 491');
            expect(callArgs.data.content).toContain('Line 500');
            expect(callArgs.data.lines).toBeLessThanOrEqual(10);
        });

        test('handles empty log file', () => {
            const projectPath = '/home/user/project';

            fs.existsSync.mockReturnValueOnce(true);
            fs.readFileSync.mockReturnValueOnce('');

            const req = {
                params: { projectPath },
                query: {},
            };

            const res = {
                json: jest.fn(),
            };

            const getHandler = router.stack.find(
                layer => layer.route && layer.route.methods.get,
            ).route.stack[0].handle;

            getHandler(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: {
                    content: '',
                    lines: 0,
                },
            });
        });

        test('handles files with trailing newline correctly', () => {
            const projectPath = '/home/user/project';
            const logContent = 'Line 1\nLine 2\nLine 3\n';

            fs.existsSync.mockReturnValueOnce(true);
            fs.readFileSync.mockReturnValueOnce(logContent);

            const req = {
                params: { projectPath },
                query: {},
            };

            const res = {
                json: jest.fn(),
            };

            const getHandler = router.stack.find(
                layer => layer.route && layer.route.methods.get,
            ).route.stack[0].handle;

            getHandler(req, res);

            const callArgs = res.json.mock.calls[0][0];
            expect(callArgs.success).toBe(true);
            expect(callArgs.data.content).toContain('Line 1');
            expect(callArgs.data.content).toContain('Line 3');
        });
    });
});
