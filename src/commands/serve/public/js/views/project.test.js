/**
 * Tests for ProjectView
 */

beforeAll(() => {
    if (typeof global.window === 'undefined') {
        global.window = global;
    }
});

describe('ProjectView', () => {
    let ProjectView;
    let savedStore;
    let savedApi;
    let savedRouter;
    let savedWsClient;

    beforeEach(() => {
        jest.resetModules();

        savedStore = global.window.Store;
        savedApi = global.window.Api;
        savedRouter = global.window.Router;
        savedWsClient = global.window.WsClient;

        global.window.Store = {
            state: { tasks: [] },
            setTasks: jest.fn(),
            setLoading: jest.fn(),
            addToast: jest.fn(),
        };
        global.window.Api = {
            getTasks: jest.fn().mockResolvedValue([]),
        };
        global.window.Router = {
            currentRoute: { value: { params: { projectPath: '/test/project' } } },
            navigate: jest.fn(),
        };
        global.window.WsClient = {
            connect: jest.fn(),
        };

        delete global.window.ProjectView;
        require('./project');
        ProjectView = global.window.ProjectView;
    });

    afterEach(() => {
        if (savedStore !== undefined) {
            global.window.Store = savedStore;
        } else {
            delete global.window.Store;
        }
        if (savedApi !== undefined) {
            global.window.Api = savedApi;
        } else {
            delete global.window.Api;
        }
        if (savedRouter !== undefined) {
            global.window.Router = savedRouter;
        } else {
            delete global.window.Router;
        }
        if (savedWsClient !== undefined) {
            global.window.WsClient = savedWsClient;
        } else {
            delete global.window.WsClient;
        }
    });

    test('should be defined on window', () => {
        expect(ProjectView).toBeDefined();
        expect(ProjectView.name).toBe('ProjectView');
    });

    test('should initialize with loading false', () => {
        const data = ProjectView.data();
        expect(data.loading).toBe(false);
    });

    describe('projectPath computed', () => {
        test('should return projectPath from Router.currentRoute', () => {
            const result = ProjectView.computed.projectPath.call({});
            expect(result).toBe('/test/project');
        });

        test('should return empty string when Router is not available', () => {
            delete global.window.Router;
            const result = ProjectView.computed.projectPath.call({});
            expect(result).toBe('');
        });

        test('should return empty string when currentRoute has no params', () => {
            global.window.Router.currentRoute.value = { params: {} };
            const result = ProjectView.computed.projectPath.call({});
            expect(result).toBe('');
        });
    });

    describe('tasks computed', () => {
        test('should return Store.state.tasks when Store is available', () => {
            const mockTasks = [{ id: 'TASK1' }];
            global.window.Store.state.tasks = mockTasks;

            const result = ProjectView.computed.tasks.call({});
            expect(result).toEqual(mockTasks);
        });

        test('should return empty array when Store is not available', () => {
            delete global.window.Store;
            const result = ProjectView.computed.tasks.call({});
            expect(result).toEqual([]);
        });
    });

    describe('projectName computed', () => {
        test('should extract last segment from projectPath', () => {
            const context = { projectPath: '/home/user/my-project' };
            const result = ProjectView.computed.projectName.call(context);
            expect(result).toBe('my-project');
        });

        test('should return full path when no slashes', () => {
            const context = { projectPath: 'simple' };
            const result = ProjectView.computed.projectName.call(context);
            expect(result).toBe('simple');
        });

        test('should handle trailing slash', () => {
            const context = { projectPath: '/home/project/' };
            const result = ProjectView.computed.projectName.call(context);
            expect(result).toBe('/home/project/');
        });
    });

    describe('loadTasks', () => {
        test('should call Api.getTasks and Store.setTasks on success', async () => {
            const tasks = [{ id: 'TASK1' }, { id: 'TASK2' }];
            global.window.Api.getTasks.mockResolvedValue(tasks);

            const context = { loading: false, projectPath: '/test/project' };
            await ProjectView.methods.loadTasks.call(context);

            expect(global.window.Api.getTasks).toHaveBeenCalledWith('/test/project');
            expect(global.window.Store.setTasks).toHaveBeenCalledWith(tasks);
            expect(context.loading).toBe(false);
        });

        test('should show error toast on API failure', async () => {
            global.window.Api.getTasks.mockRejectedValue(new Error('API error'));

            const consoleError = jest.spyOn(console, 'error').mockImplementation();
            const context = { loading: false, projectPath: '/test/project' };
            await ProjectView.methods.loadTasks.call(context);

            expect(global.window.Store.addToast).toHaveBeenCalledWith({
                message: 'Failed to load tasks: API error',
                type: 'error',
            });
            expect(context.loading).toBe(false);
            consoleError.mockRestore();
        });

        test('should not call API if projectPath is empty', async () => {
            const context = { loading: false, projectPath: '' };
            await ProjectView.methods.loadTasks.call(context);
            expect(global.window.Api.getTasks).not.toHaveBeenCalled();
        });

        test('should not call API if Api is not available', async () => {
            delete global.window.Api;
            const context = { loading: false, projectPath: '/test' };
            await ProjectView.methods.loadTasks.call(context);
            expect(context.loading).toBe(false);
        });
    });

    describe('connectWebSocket', () => {
        test('should call WsClient.connect with projectPath', () => {
            const context = { projectPath: '/test/project' };
            ProjectView.methods.connectWebSocket.call(context);

            expect(global.window.WsClient.connect).toHaveBeenCalledWith('/test/project');
        });

        test('should not throw when WsClient is not available', () => {
            delete global.window.WsClient;
            const context = { projectPath: '/test/project' };
            expect(() => {
                ProjectView.methods.connectWebSocket.call(context);
            }).not.toThrow();
        });

        test('should not connect when projectPath is empty', () => {
            const context = { projectPath: '' };
            ProjectView.methods.connectWebSocket.call(context);
            expect(global.window.WsClient.connect).not.toHaveBeenCalled();
        });
    });

    describe('goBack', () => {
        test('should navigate to root', () => {
            ProjectView.methods.goBack.call({});
            expect(global.window.Router.navigate).toHaveBeenCalledWith('/');
        });

        test('should not throw when Router is not available', () => {
            delete global.window.Router;
            expect(() => {
                ProjectView.methods.goBack.call({});
            }).not.toThrow();
        });
    });

    describe('watch.projectPath', () => {
        test('should have immediate handler', () => {
            expect(ProjectView.watch.projectPath.immediate).toBe(true);
            expect(typeof ProjectView.watch.projectPath.handler).toBe('function');
        });

        test('handler should call loadTasks and connectWebSocket when path is truthy', () => {
            const context = {
                loadTasks: jest.fn(),
                connectWebSocket: jest.fn(),
            };

            ProjectView.watch.projectPath.handler.call(context, '/new/path');

            expect(context.loadTasks).toHaveBeenCalled();
            expect(context.connectWebSocket).toHaveBeenCalled();
        });

        test('handler should not call loadTasks when path is empty', () => {
            const context = {
                loadTasks: jest.fn(),
                connectWebSocket: jest.fn(),
            };

            ProjectView.watch.projectPath.handler.call(context, '');

            expect(context.loadTasks).not.toHaveBeenCalled();
            expect(context.connectWebSocket).not.toHaveBeenCalled();
        });
    });

    test('should have template with task-card usage', () => {
        expect(typeof ProjectView.template).toBe('string');
        expect(ProjectView.template).toContain('task-card');
    });
});
