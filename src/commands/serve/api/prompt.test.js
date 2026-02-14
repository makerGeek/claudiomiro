/**
 * Tests for prompt.js - AI_PROMPT.md API Router
 */

const { createPromptRouter } = require('./prompt');
const fs = require('fs');

// Mock fs module
jest.mock('fs');

describe('createPromptRouter', () => {
    let router;

    beforeEach(() => {
        // Create router with empty options
        router = createPromptRouter({});

        // Clear all mocks
        jest.clearAllMocks();
    });

    describe('Router handlers', () => {
        test('should create a valid Express router with GET and PUT routes', () => {
            expect(router).toBeDefined();
            expect(router.stack).toBeDefined();

            // Find GET and PUT routes
            const getRoute = router.stack.find(
                layer => layer.route && layer.route.methods.get,
            );
            const putRoute = router.stack.find(
                layer => layer.route && layer.route.methods.put,
            );

            expect(getRoute).toBeDefined();
            expect(putRoute).toBeDefined();
        });
    });

    describe('GET handler', () => {
        test('reads AI_PROMPT.md and returns content when file exists', () => {
            const testContent = '# AI Prompt\n\nTest content';
            const projectPath = '/home/user/project';

            fs.existsSync.mockReturnValueOnce(true);
            fs.readFileSync.mockReturnValueOnce(testContent);

            const req = {
                params: { projectPath },
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
                data: { content: testContent },
            });
        });

        test('returns 404 when AI_PROMPT.md does not exist', () => {
            const projectPath = '/home/user/project';

            fs.existsSync.mockReturnValueOnce(false);

            const req = {
                params: { projectPath },
            };

            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            const getHandler = router.stack.find(
                layer => layer.route && layer.route.methods.get,
            ).route.stack[0].handle;

            getHandler(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'AI_PROMPT.md not found',
            });
        });

        test('returns 400 when projectPath is missing', () => {
            const req = {
                params: {},
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

        test('handles read errors gracefully', () => {
            const projectPath = '/home/user/project';

            fs.existsSync.mockReturnValueOnce(true);
            fs.readFileSync.mockImplementationOnce(() => {
                throw new Error('Permission denied');
            });

            const req = {
                params: { projectPath },
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
                error: 'Failed to read AI_PROMPT.md',
            });
        });
    });

    describe('PUT handler', () => {
        test('writes content to AI_PROMPT.md when valid', () => {
            const projectPath = '/home/user/project';
            const newContent = '# New Prompt\n\nContent here';

            fs.existsSync.mockReturnValueOnce(true);
            fs.mkdirSync.mockReturnValueOnce(undefined);
            fs.writeFileSync.mockReturnValueOnce(undefined);

            const req = {
                params: { projectPath },
                body: { content: newContent },
            };

            const res = {
                json: jest.fn(),
            };

            const putHandler = router.stack.find(
                layer => layer.route && layer.route.methods.put,
            ).route.stack[0].handle;

            putHandler(req, res);

            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('.claudiomiro'),
                newContent,
                'utf8',
            );
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: { message: 'AI_PROMPT.md updated successfully' },
            });
        });

        test('returns 400 when content is empty', () => {
            const projectPath = '/home/user/project';

            const req = {
                params: { projectPath },
                body: { content: '' },
            };

            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            const putHandler = router.stack.find(
                layer => layer.route && layer.route.methods.put,
            ).route.stack[0].handle;

            putHandler(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Content must be a non-empty string',
            });
            expect(fs.writeFileSync).not.toHaveBeenCalled();
        });

        test('returns 400 when content is whitespace-only', () => {
            const projectPath = '/home/user/project';

            const req = {
                params: { projectPath },
                body: { content: '   \n  \t  ' },
            };

            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            const putHandler = router.stack.find(
                layer => layer.route && layer.route.methods.put,
            ).route.stack[0].handle;

            putHandler(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(fs.writeFileSync).not.toHaveBeenCalled();
        });

        test('returns 400 when content is missing', () => {
            const projectPath = '/home/user/project';

            const req = {
                params: { projectPath },
                body: {},
            };

            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            const putHandler = router.stack.find(
                layer => layer.route && layer.route.methods.put,
            ).route.stack[0].handle;

            putHandler(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(fs.writeFileSync).not.toHaveBeenCalled();
        });

        test('returns 400 when projectPath is missing', () => {
            const req = {
                params: {},
                body: { content: 'test' },
            };

            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            const putHandler = router.stack.find(
                layer => layer.route && layer.route.methods.put,
            ).route.stack[0].handle;

            putHandler(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(fs.writeFileSync).not.toHaveBeenCalled();
        });

        test('creates directory if it does not exist', () => {
            const projectPath = '/home/user/project';
            const newContent = 'test content';

            fs.existsSync.mockReturnValueOnce(false);
            fs.mkdirSync.mockReturnValueOnce(undefined);
            fs.writeFileSync.mockReturnValueOnce(undefined);

            const req = {
                params: { projectPath },
                body: { content: newContent },
            };

            const res = {
                json: jest.fn(),
            };

            const putHandler = router.stack.find(
                layer => layer.route && layer.route.methods.put,
            ).route.stack[0].handle;

            putHandler(req, res);

            expect(fs.mkdirSync).toHaveBeenCalledWith(
                expect.stringContaining('.claudiomiro'),
                { recursive: true },
            );
            expect(res.json).toHaveBeenCalled();
        });

        test('handles write errors gracefully', () => {
            const projectPath = '/home/user/project';

            fs.existsSync.mockReturnValueOnce(true);
            fs.mkdirSync.mockReturnValueOnce(undefined);
            fs.writeFileSync.mockImplementationOnce(() => {
                throw new Error('Permission denied');
            });

            const req = {
                params: { projectPath },
                body: { content: 'test' },
            };

            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            const putHandler = router.stack.find(
                layer => layer.route && layer.route.methods.put,
            ).route.stack[0].handle;

            putHandler(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Failed to write AI_PROMPT.md',
            });
        });
    });
});
