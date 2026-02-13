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

    describe('GET /api/projects/:projectPath/logs', () => {
        test('should return recent log.txt content when file exists', (done) => {
            const projectPath = '/home/user/project';
            const logContent = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';

            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(logContent);

            const req = {
                params: { projectPath },
                query: {},
            };

            const res = {
                json: jest.fn((data) => {
                    expect(data.success).toBe(true);
                    expect(data.data.content).toContain('Line');
                    expect(data.data.lines).toBe(5);
                    expect(fs.readFileSync).toHaveBeenCalledWith(
                        expect.stringContaining('.claudiomiro/log.txt'),
                        'utf8',
                    );
                    done();
                }),
            };

            const callback = router.stack.find(
                layer => layer.route && layer.route.methods.get,
            ).handle;
            const next = jest.fn();
            callback(req, res, next);
        });

        test('should return empty logs when log.txt does not exist', (done) => {
            const projectPath = '/home/user/project';

            fs.existsSync.mockReturnValue(false);

            const req = {
                params: { projectPath },
                query: {},
            };

            const res = {
                json: jest.fn((data) => {
                    expect(data.success).toBe(true);
                    expect(data.data.content).toBe('');
                    expect(data.data.lines).toBe(0);
                    done();
                }),
            };

            const callback = router.stack.find(
                layer => layer.route && layer.route.methods.get,
            ).handle;
            const next = jest.fn();
            callback(req, res, next);
        });

        test('should respect custom lines query parameter', (done) => {
            const projectPath = '/home/user/project';
            const logContent = Array.from({ length: 150 }, (_, i) => `Line ${i + 1}`).join('\n');

            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(logContent);

            const req = {
                params: { projectPath },
                query: { lines: '50' },
            };

            const res = {
                json: jest.fn((data) => {
                    expect(data.success).toBe(true);
                    expect(data.data.lines).toBeLessThanOrEqual(50);
                    done();
                }),
            };

            const callback = router.stack.find(
                layer => layer.route && layer.route.methods.get,
            ).handle;
            const next = jest.fn();
            callback(req, res, next);
        });

        test('should return 400 when projectPath is missing', (done) => {
            const req = {
                params: {},
                query: {},
            };

            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn((data) => {
                    expect(res.status).toHaveBeenCalledWith(400);
                    expect(data.success).toBe(false);
                    expect(data.error).toContain('Project path');
                    done();
                }),
            };

            const callback = router.stack.find(
                layer => layer.route && layer.route.methods.get,
            ).handle;
            const next = jest.fn();
            callback(req, res, next);
        });

        test('should use default 100 lines when lines param is invalid', (done) => {
            const projectPath = '/home/user/project';
            const logContent = Array.from({ length: 150 }, (_, i) => `Line ${i + 1}`).join('\n');

            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(logContent);

            const req = {
                params: { projectPath },
                query: { lines: 'invalid' },
            };

            const res = {
                json: jest.fn((data) => {
                    expect(data.success).toBe(true);
                    expect(data.data.lines).toBeLessThanOrEqual(100);
                    done();
                }),
            };

            const callback = router.stack.find(
                layer => layer.route && layer.route.methods.get,
            ).handle;
            const next = jest.fn();
            callback(req, res, next);
        });

        test('should handle read errors gracefully', (done) => {
            const projectPath = '/home/user/project';

            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockImplementation(() => {
                throw new Error('Permission denied');
            });

            const req = {
                params: { projectPath },
                query: {},
            };

            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn((data) => {
                    expect(res.status).toHaveBeenCalledWith(500);
                    expect(data.success).toBe(false);
                    expect(data.error).toContain('Failed to read');
                    done();
                }),
            };

            const callback = router.stack.find(
                layer => layer.route && layer.route.methods.get,
            ).handle;
            const next = jest.fn();
            callback(req, res, next);
        });

        test('should correctly tail large log files', (done) => {
            const projectPath = '/home/user/project';
            const logContent = Array.from({ length: 500 }, (_, i) => `Line ${i + 1}`).join('\n');

            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(logContent);

            const req = {
                params: { projectPath },
                query: { lines: '10' },
            };

            const res = {
                json: jest.fn((data) => {
                    expect(data.success).toBe(true);
                    expect(data.data.content).toContain('Line 490');
                    expect(data.data.content).toContain('Line 500');
                    expect(data.data.lines).toBeLessThanOrEqual(10);
                    done();
                }),
            };

            const callback = router.stack.find(
                layer => layer.route && layer.route.methods.get,
            ).handle;
            const next = jest.fn();
            callback(req, res, next);
        });

        test('should handle empty log file', (done) => {
            const projectPath = '/home/user/project';

            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('');

            const req = {
                params: { projectPath },
                query: {},
            };

            const res = {
                json: jest.fn((data) => {
                    expect(data.success).toBe(true);
                    expect(data.data.content).toBe('');
                    expect(data.data.lines).toBe(0);
                    done();
                }),
            };

            const callback = router.stack.find(
                layer => layer.route && layer.route.methods.get,
            ).handle;
            const next = jest.fn();
            callback(req, res, next);
        });

        test('should handle files with trailing newline correctly', (done) => {
            const projectPath = '/home/user/project';
            const logContent = 'Line 1\nLine 2\nLine 3\n';

            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(logContent);

            const req = {
                params: { projectPath },
                query: {},
            };

            const res = {
                json: jest.fn((data) => {
                    expect(data.success).toBe(true);
                    expect(data.data.content).toContain('Line 1');
                    expect(data.data.content).toContain('Line 3');
                    done();
                }),
            };

            const callback = router.stack.find(
                layer => layer.route && layer.route.methods.get,
            ).handle;
            const next = jest.fn();
            callback(req, res, next);
        });
    });

    describe('Router structure', () => {
        test('should create a valid Express router', () => {
            expect(router).toBeDefined();
            expect(router.stack).toBeDefined();
            expect(router.stack.length).toBeGreaterThan(0);
        });

        test('should have GET route', () => {
            const hasGet = router.stack.some(
                layer => layer.route && layer.route.methods.get,
            );
            expect(hasGet).toBe(true);
        });
    });
});
