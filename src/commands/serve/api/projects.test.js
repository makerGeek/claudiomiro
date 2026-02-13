/**
 * Unit tests for projects.js
 */

const fs = require('fs');
const path = require('path');
const createProjectsRouter = require('./projects');

// Mock dependencies
jest.mock('fs');
jest.mock('./path-utils', () => ({
    validateProjectPath: jest.fn(),
    getTaskExecutorPath: jest.fn(),
    decodeProjectPath: jest.fn((p) => p),
    sendSuccess: jest.fn((res, data) => res.json({ success: true, data })),
    sendError: jest.fn((res, code, msg) => res.status(code).json({ success: false, error: msg })),
}));

const pathUtils = require('./path-utils');

describe('projects router', () => {
    let router;
    let mockReq;
    let mockRes;

    beforeEach(() => {
        jest.clearAllMocks();

        mockReq = {
            params: {},
        };

        mockRes = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis(),
        };

        // Reset path-utils mocks
        pathUtils.getTaskExecutorPath.mockImplementation((p) => path.join(p, '.claudiomiro', 'task-executor'));
    });

    describe('GET /api/projects', () => {
        test('should return empty array when no projects', () => {
            router = createProjectsRouter({ projectPaths: [] });

            // Find the GET / handler
            const handler = router.stack.find(layer => layer.route?.path === '/')?.route.stack[0].handle;
            handler(mockReq, mockRes);

            expect(pathUtils.sendSuccess).toHaveBeenCalledWith(mockRes, []);
        });

        test('should return projects with task counts', () => {
            const projectPaths = ['/project1', '/project2'];
            fs.existsSync.mockReturnValue(true);
            fs.readdirSync.mockReturnValue(['TASK0', 'TASK1', 'cache']);
            fs.statSync.mockReturnValue({ isDirectory: () => true });
            fs.readFileSync.mockReturnValue(JSON.stringify({
                status: 'completed',
                completion: { status: 'completed' },
            }));

            router = createProjectsRouter({ projectPaths });

            const handler = router.stack.find(layer => layer.route?.path === '/')?.route.stack[0].handle;
            handler(mockReq, mockRes);

            expect(pathUtils.sendSuccess).toHaveBeenCalled();
            const [[, projects]] = pathUtils.sendSuccess.mock.calls;
            expect(projects).toHaveLength(2);
            expect(projects[0]).toHaveProperty('name');
            expect(projects[0]).toHaveProperty('path');
            expect(projects[0]).toHaveProperty('taskCount');
            expect(projects[0]).toHaveProperty('completedCount');
        });

        test('should skip projects without .claudiomiro/task-executor/', () => {
            const projectPaths = ['/project1', '/project2'];
            fs.existsSync.mockReturnValue(false);

            router = createProjectsRouter({ projectPaths });

            const handler = router.stack.find(layer => layer.route?.path === '/')?.route.stack[0].handle;
            handler(mockReq, mockRes);

            expect(pathUtils.sendSuccess).toHaveBeenCalledWith(mockRes, []);
        });

        test('should handle errors gracefully', () => {
            const projectPaths = ['/project1'];
            fs.existsSync.mockImplementation(() => {
                throw new Error('Filesystem error');
            });

            router = createProjectsRouter({ projectPaths });

            const handler = router.stack.find(layer => layer.route?.path === '/')?.route.stack[0].handle;
            handler(mockReq, mockRes);

            expect(pathUtils.sendError).toHaveBeenCalledWith(mockRes, 500, expect.any(String));
        });
    });

    describe('GET /api/projects/:projectPath/state', () => {
        test('should return error for invalid project path', () => {
            pathUtils.validateProjectPath.mockReturnValue({
                valid: false,
                error: 'Invalid path',
            });

            router = createProjectsRouter({ projectPaths: ['/project1'] });
            mockReq.params.projectPath = '/invalid';

            const handler = router.stack.find(layer => layer.route?.path === '/:projectPath/state')?.route.stack[0].handle;
            handler(mockReq, mockRes);

            expect(pathUtils.sendError).toHaveBeenCalledWith(mockRes, 400, 'Invalid path');
        });

        test('should return project state with tasks', () => {
            pathUtils.validateProjectPath.mockReturnValue({
                valid: true,
                resolvedPath: '/project1',
            });

            fs.readdirSync.mockReturnValue(['TASK0', 'TASK1']);
            fs.statSync.mockReturnValue({ isDirectory: () => true });
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('execution.json')) {
                    return JSON.stringify({
                        status: 'in_progress',
                        title: 'Test Task',
                        currentPhase: { id: 1, name: 'Phase 1' },
                        completion: { status: 'pending_validation' },
                    });
                }
                if (filePath.includes('BLUEPRINT.md')) {
                    return '@dependencies [TASK0]';
                }
                return '';
            });

            router = createProjectsRouter({ projectPaths: ['/project1'] });
            mockReq.params.projectPath = '/project1';

            const handler = router.stack.find(layer => layer.route?.path === '/:projectPath/state')?.route.stack[0].handle;
            handler(mockReq, mockRes);

            expect(pathUtils.sendSuccess).toHaveBeenCalled();
            const [[, state]] = pathUtils.sendSuccess.mock.calls;
            expect(state).toHaveProperty('project');
            expect(state).toHaveProperty('tasks');
            expect(state).toHaveProperty('overallStatus');
            expect(state).toHaveProperty('progress');
            expect(state).toHaveProperty('summary');
            expect(state.tasks).toHaveLength(2);
        });

        test('should calculate correct overall status - in_progress', () => {
            pathUtils.validateProjectPath.mockReturnValue({
                valid: true,
                resolvedPath: '/project1',
            });

            fs.readdirSync.mockReturnValue(['TASK0']);
            fs.statSync.mockReturnValue({ isDirectory: () => true });
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({
                status: 'in_progress',
            }));

            router = createProjectsRouter({ projectPaths: ['/project1'] });
            mockReq.params.projectPath = '/project1';

            const handler = router.stack.find(layer => layer.route?.path === '/:projectPath/state')?.route.stack[0].handle;
            handler(mockReq, mockRes);

            const [[, state]] = pathUtils.sendSuccess.mock.calls;
            expect(state.overallStatus).toBe('in_progress');
        });

        test('should calculate correct overall status - completed', () => {
            pathUtils.validateProjectPath.mockReturnValue({
                valid: true,
                resolvedPath: '/project1',
            });

            fs.readdirSync.mockReturnValue(['TASK0']);
            fs.statSync.mockReturnValue({ isDirectory: () => true });
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({
                status: 'completed',
                completion: { status: 'completed' },
            }));

            router = createProjectsRouter({ projectPaths: ['/project1'] });
            mockReq.params.projectPath = '/project1';

            const handler = router.stack.find(layer => layer.route?.path === '/:projectPath/state')?.route.stack[0].handle;
            handler(mockReq, mockRes);

            const [[, state]] = pathUtils.sendSuccess.mock.calls;
            expect(state.overallStatus).toBe('completed');
            expect(state.progress).toBe(100);
        });

        test('should handle empty project (no tasks)', () => {
            pathUtils.validateProjectPath.mockReturnValue({
                valid: true,
                resolvedPath: '/project1',
            });

            fs.readdirSync.mockReturnValue([]);

            router = createProjectsRouter({ projectPaths: ['/project1'] });
            mockReq.params.projectPath = '/project1';

            const handler = router.stack.find(layer => layer.route?.path === '/:projectPath/state')?.route.stack[0].handle;
            handler(mockReq, mockRes);

            const [[, state]] = pathUtils.sendSuccess.mock.calls;
            expect(state.tasks).toHaveLength(0);
            expect(state.overallStatus).toBe('idle');
            expect(state.progress).toBe(0);
        });

        test('should handle malformed execution.json gracefully', () => {
            pathUtils.validateProjectPath.mockReturnValue({
                valid: true,
                resolvedPath: '/project1',
            });

            fs.readdirSync.mockReturnValue(['TASK0']);
            fs.statSync.mockReturnValue({ isDirectory: () => true });
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('invalid json{');

            router = createProjectsRouter({ projectPaths: ['/project1'] });
            mockReq.params.projectPath = '/project1';

            const handler = router.stack.find(layer => layer.route?.path === '/:projectPath/state')?.route.stack[0].handle;
            handler(mockReq, mockRes);

            expect(pathUtils.sendSuccess).toHaveBeenCalled();
            const [[, state]] = pathUtils.sendSuccess.mock.calls;
            expect(state.tasks[0].status).toBe('unknown');
        });

        test('should parse dependencies from BLUEPRINT.md', () => {
            pathUtils.validateProjectPath.mockReturnValue({
                valid: true,
                resolvedPath: '/project1',
            });

            fs.readdirSync.mockReturnValue(['TASK1']);
            fs.statSync.mockReturnValue({ isDirectory: () => true });
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('BLUEPRINT.md')) {
                    return '@dependencies [TASK0, TASK1]';
                }
                return '{}';
            });

            router = createProjectsRouter({ projectPaths: ['/project1'] });
            mockReq.params.projectPath = '/project1';

            const handler = router.stack.find(layer => layer.route?.path === '/:projectPath/state')?.route.stack[0].handle;
            handler(mockReq, mockRes);

            const [[, state]] = pathUtils.sendSuccess.mock.calls;
            expect(state.tasks[0].dependencies).toContain('TASK0');
        });
    });
});
