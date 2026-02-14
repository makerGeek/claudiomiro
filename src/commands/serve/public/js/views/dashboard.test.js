/**
 * Tests for DashboardView
 */

beforeAll(() => {
    if (typeof global.window === 'undefined') {
        global.window = global;
    }
});

describe('DashboardView', () => {
    let DashboardView;
    let savedStore;
    let savedApi;
    let savedRouter;

    beforeEach(() => {
        jest.resetModules();

        savedStore = global.window.Store;
        savedApi = global.window.Api;
        savedRouter = global.window.Router;

        global.window.Store = {
            state: { projects: [] },
            setProjects: jest.fn(),
            setLoading: jest.fn(),
            addToast: jest.fn(),
        };
        global.window.Api = {
            getProjects: jest.fn().mockResolvedValue([]),
        };
        global.window.Router = {
            navigate: jest.fn(),
        };

        delete global.window.DashboardView;
        require('./dashboard');
        DashboardView = global.window.DashboardView;
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
    });

    test('should be defined on window', () => {
        expect(DashboardView).toBeDefined();
        expect(DashboardView.name).toBe('DashboardView');
    });

    test('should initialize with loading false', () => {
        const data = DashboardView.data();
        expect(data.loading).toBe(false);
    });

    describe('projects computed', () => {
        test('should return Store.state.projects when Store is available', () => {
            const mockProjects = [{ path: '/test', name: 'Test' }];
            global.window.Store.state.projects = mockProjects;

            const result = DashboardView.computed.projects.call({});
            expect(result).toEqual(mockProjects);
        });

        test('should return empty array when Store is not available', () => {
            delete global.window.Store;
            const result = DashboardView.computed.projects.call({});
            expect(result).toEqual([]);
        });
    });

    describe('loadProjects', () => {
        test('should call Api.getProjects and Store.setProjects on success', async () => {
            const projects = [{ path: '/proj', name: 'Proj' }];
            global.window.Api.getProjects.mockResolvedValue(projects);

            const context = { loading: false };
            await DashboardView.methods.loadProjects.call(context);

            expect(global.window.Api.getProjects).toHaveBeenCalled();
            expect(global.window.Store.setProjects).toHaveBeenCalledWith(projects);
            expect(global.window.Store.setLoading).toHaveBeenCalledWith('projects', true);
            expect(global.window.Store.setLoading).toHaveBeenCalledWith('projects', false);
            expect(context.loading).toBe(false);
        });

        test('should show error toast on API failure', async () => {
            global.window.Api.getProjects.mockRejectedValue(new Error('Network error'));

            const consoleError = jest.spyOn(console, 'error').mockImplementation();
            const context = { loading: false };
            await DashboardView.methods.loadProjects.call(context);

            expect(global.window.Store.addToast).toHaveBeenCalledWith({
                message: 'Failed to load projects: Network error',
                type: 'error',
            });
            expect(context.loading).toBe(false);
            consoleError.mockRestore();
        });

        test('should not call API if Api is not available', async () => {
            delete global.window.Api;
            const context = { loading: false };
            await DashboardView.methods.loadProjects.call(context);
            expect(context.loading).toBe(false);
        });

        test('should not call API if Store is not available', async () => {
            const apiGetProjects = global.window.Api.getProjects;
            delete global.window.Store;
            const context = { loading: false };
            await DashboardView.methods.loadProjects.call(context);
            expect(apiGetProjects).not.toHaveBeenCalled();
        });
    });

    describe('navigateToProject', () => {
        test('should call Router.navigate with project path', () => {
            DashboardView.methods.navigateToProject.call({}, '/my/project');

            expect(global.window.Router.navigate).toHaveBeenCalledWith('/project//my/project');
        });

        test('should not throw when Router is not available', () => {
            delete global.window.Router;
            expect(() => {
                DashboardView.methods.navigateToProject.call({}, '/test');
            }).not.toThrow();
        });
    });

    describe('getTaskSummary', () => {
        test('should return null when project has no tasks', () => {
            const result = DashboardView.methods.getTaskSummary.call({}, {});
            expect(result).toBeNull();
        });

        test('should return null when tasks is not an array', () => {
            const result = DashboardView.methods.getTaskSummary.call({}, { tasks: 'not-array' });
            expect(result).toBeNull();
        });

        test('should calculate correct task summary', () => {
            const project = {
                tasks: [
                    { status: 'completed' },
                    { status: 'completed' },
                    { status: 'failed' },
                    { status: 'running' },
                    { status: 'in_progress' },
                    { status: 'pending' },
                ],
            };

            const result = DashboardView.methods.getTaskSummary.call({}, project);

            expect(result).toEqual({
                total: 6,
                completed: 2,
                failed: 1,
                running: 2,
                pending: 1,
            });
        });

        test('should handle empty tasks array', () => {
            const result = DashboardView.methods.getTaskSummary.call({}, { tasks: [] });
            expect(result).toEqual({
                total: 0,
                completed: 0,
                failed: 0,
                running: 0,
                pending: 0,
            });
        });
    });

    test('should have template', () => {
        expect(typeof DashboardView.template).toBe('string');
        expect(DashboardView.template).toContain('Projects');
    });
});
