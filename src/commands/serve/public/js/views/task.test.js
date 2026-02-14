/**
 * Tests for TaskView
 */

beforeAll(() => {
    if (typeof global.window === 'undefined') {
        global.window = global;
    }
});

describe('TaskView', () => {
    let TaskView;
    let savedStore;
    let savedApi;
    let savedRouter;

    beforeEach(() => {
        jest.resetModules();

        savedStore = global.window.Store;
        savedApi = global.window.Api;
        savedRouter = global.window.Router;

        global.window.Store = {
            state: { currentTask: null },
            setCurrentTask: jest.fn(),
            setLoading: jest.fn(),
            addToast: jest.fn(),
        };
        global.window.Api = {
            getTask: jest.fn().mockResolvedValue({}),
            getBlueprint: jest.fn().mockResolvedValue({ content: '# Blueprint' }),
            getExecution: jest.fn().mockResolvedValue({ phases: [] }),
            getReview: jest.fn().mockResolvedValue({ content: '# Review' }),
            updateBlueprint: jest.fn().mockResolvedValue({}),
            retryTask: jest.fn().mockResolvedValue({}),
            approveReview: jest.fn().mockResolvedValue({}),
        };
        global.window.Router = {
            currentRoute: {
                value: {
                    params: { projectPath: '/test/project', taskId: 'TASK1' },
                },
            },
        };

        delete global.window.TaskView;
        require('./task');
        TaskView = global.window.TaskView;
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
        expect(TaskView).toBeDefined();
        expect(TaskView.name).toBe('TaskView');
    });

    test('should initialize with correct default data', () => {
        const data = TaskView.data();
        expect(data.activeTab).toBe('overview');
        expect(data.loading).toBe(false);
        expect(data.blueprintContent).toBe('');
        expect(data.blueprintLoading).toBe(false);
        expect(data.executionData).toBeNull();
        expect(data.executionLoading).toBe(false);
        expect(data.executionRaw).toBe('');
        expect(data.showRawExecution).toBe(false);
        expect(data.reviewContent).toBe('');
        expect(data.reviewLoading).toBe(false);
        expect(data.retrying).toBe(false);
        expect(data.approving).toBe(false);
    });

    describe('projectPath computed', () => {
        test('should return projectPath from Router', () => {
            const result = TaskView.computed.projectPath.call({});
            expect(result).toBe('/test/project');
        });

        test('should return empty string when Router is not available', () => {
            delete global.window.Router;
            const result = TaskView.computed.projectPath.call({});
            expect(result).toBe('');
        });
    });

    describe('taskId computed', () => {
        test('should return taskId from Router', () => {
            const result = TaskView.computed.taskId.call({});
            expect(result).toBe('TASK1');
        });

        test('should return empty string when Router is not available', () => {
            delete global.window.Router;
            const result = TaskView.computed.taskId.call({});
            expect(result).toBe('');
        });
    });

    describe('task computed', () => {
        test('should return Store.state.currentTask', () => {
            const mockTask = { id: 'TASK1', status: 'running' };
            global.window.Store.state.currentTask = mockTask;
            const result = TaskView.computed.task.call({});
            expect(result).toEqual(mockTask);
        });

        test('should return null when Store is not available', () => {
            delete global.window.Store;
            const result = TaskView.computed.task.call({});
            expect(result).toBeNull();
        });
    });

    describe('tabs computed', () => {
        test('should return 4 tabs', () => {
            const result = TaskView.computed.tabs.call({});
            expect(result).toHaveLength(4);
            expect(result.map(t => t.id)).toEqual(['overview', 'blueprint', 'execution', 'review']);
            expect(result.map(t => t.label)).toEqual(['Overview', 'Blueprint', 'Execution', 'Review']);
        });
    });

    describe('canRetry computed', () => {
        test('should return true when task status is failed', () => {
            const context = { task: { status: 'failed' } };
            expect(TaskView.computed.canRetry.call(context)).toBe(true);
        });

        test('should return false when task status is not failed', () => {
            const context = { task: { status: 'running' } };
            expect(TaskView.computed.canRetry.call(context)).toBe(false);
        });

        test('should return false when task is null', () => {
            const context = { task: null };
            expect(TaskView.computed.canRetry.call(context)).toBeFalsy();
        });
    });

    describe('canApprove computed', () => {
        test('should return true when task has review and completion is not completed', () => {
            const context = {
                task: { completion: { status: 'pending_validation' } },
                reviewContent: '# Review content',
            };
            expect(TaskView.computed.canApprove.call(context)).toBeTruthy();
        });

        test('should return false when task is null', () => {
            const context = { task: null, reviewContent: 'review' };
            expect(TaskView.computed.canApprove.call(context)).toBeFalsy();
        });

        test('should return false when reviewContent is empty', () => {
            const context = {
                task: { completion: { status: 'pending' } },
                reviewContent: '',
            };
            expect(TaskView.computed.canApprove.call(context)).toBeFalsy();
        });

        test('should return false when completion status is completed', () => {
            const context = {
                task: { completion: { status: 'completed' } },
                reviewContent: 'review',
            };
            expect(TaskView.computed.canApprove.call(context)).toBe(false);
        });
    });

    describe('phases computed', () => {
        test('should return executionData.phases when available', () => {
            const phases = [{ id: 1, name: 'Phase 1' }];
            const context = { executionData: { phases }, task: { phases: [] } };
            expect(TaskView.computed.phases.call(context)).toEqual(phases);
        });

        test('should fallback to task.phases', () => {
            const phases = [{ id: 1, name: 'From task' }];
            const context = { executionData: null, task: { phases } };
            expect(TaskView.computed.phases.call(context)).toEqual(phases);
        });

        test('should return empty array when no phases available', () => {
            const context = { executionData: null, task: null };
            expect(TaskView.computed.phases.call(context)).toEqual([]);
        });
    });

    describe('artifacts computed', () => {
        test('should return executionData.artifacts when available', () => {
            const artifacts = [{ path: 'file.js', verified: true }];
            const context = { executionData: { artifacts }, task: {} };
            expect(TaskView.computed.artifacts.call(context)).toEqual(artifacts);
        });

        test('should fallback to task.artifacts', () => {
            const artifacts = [{ path: 'from-task.js' }];
            const context = { executionData: null, task: { artifacts } };
            expect(TaskView.computed.artifacts.call(context)).toEqual(artifacts);
        });

        test('should return empty array when no artifacts', () => {
            const context = { executionData: null, task: {} };
            expect(TaskView.computed.artifacts.call(context)).toEqual([]);
        });
    });

    describe('uncertainties computed', () => {
        test('should return executionData.uncertainties when available', () => {
            const uncertainties = [{ id: 'U1', topic: 'Test' }];
            const context = { executionData: { uncertainties } };
            expect(TaskView.computed.uncertainties.call(context)).toEqual(uncertainties);
        });

        test('should return empty array when no executionData', () => {
            const context = { executionData: null };
            expect(TaskView.computed.uncertainties.call(context)).toEqual([]);
        });
    });

    describe('errorHistory computed', () => {
        test('should return task.errorHistory first', () => {
            const errors = [{ message: 'Error 1' }];
            const context = { task: { errorHistory: errors }, executionData: { errorHistory: [] } };
            expect(TaskView.computed.errorHistory.call(context)).toEqual(errors);
        });

        test('should fallback to executionData.errorHistory', () => {
            const errors = [{ message: 'From execution' }];
            const context = { task: {}, executionData: { errorHistory: errors } };
            expect(TaskView.computed.errorHistory.call(context)).toEqual(errors);
        });

        test('should return empty array when no errors', () => {
            const context = { task: null, executionData: null };
            expect(TaskView.computed.errorHistory.call(context)).toEqual([]);
        });
    });

    describe('completionSummary computed', () => {
        test('should return executionData.completion when available', () => {
            const completion = { status: 'completed', summary: ['Done'] };
            const context = { executionData: { completion }, task: {} };
            expect(TaskView.computed.completionSummary.call(context)).toEqual(completion);
        });

        test('should fallback to task.completion', () => {
            const completion = { status: 'blocked' };
            const context = { executionData: null, task: { completion } };
            expect(TaskView.computed.completionSummary.call(context)).toEqual(completion);
        });

        test('should return null when no completion', () => {
            const context = { executionData: null, task: {} };
            expect(TaskView.computed.completionSummary.call(context)).toBeNull();
        });
    });

    describe('currentPhase computed', () => {
        test('should return executionData.currentPhase when available', () => {
            const phase = { id: 2, name: 'Implementation' };
            const context = { executionData: { currentPhase: phase }, task: {} };
            expect(TaskView.computed.currentPhase.call(context)).toEqual(phase);
        });

        test('should fallback to task.currentPhase', () => {
            const phase = { id: 1, name: 'Prep' };
            const context = { executionData: null, task: { currentPhase: phase } };
            expect(TaskView.computed.currentPhase.call(context)).toEqual(phase);
        });
    });

    describe('onTabChange', () => {
        test('should set activeTab', () => {
            const context = { activeTab: 'overview' };
            TaskView.methods.onTabChange.call(context, 'blueprint');
            expect(context.activeTab).toBe('blueprint');
        });
    });

    describe('loadTask', () => {
        test('should call Api.getTask and Store.setCurrentTask', async () => {
            const task = { id: 'TASK1', status: 'running' };
            global.window.Api.getTask.mockResolvedValue(task);

            const context = { loading: false, projectPath: '/test', taskId: 'TASK1' };
            await TaskView.methods.loadTask.call(context);

            expect(global.window.Api.getTask).toHaveBeenCalledWith('/test', 'TASK1');
            expect(global.window.Store.setCurrentTask).toHaveBeenCalledWith(task);
            expect(context.loading).toBe(false);
        });

        test('should show error toast on failure', async () => {
            global.window.Api.getTask.mockRejectedValue(new Error('Not found'));

            const consoleError = jest.spyOn(console, 'error').mockImplementation();
            const context = { loading: false, projectPath: '/test', taskId: 'TASK1' };
            await TaskView.methods.loadTask.call(context);

            expect(global.window.Store.addToast).toHaveBeenCalledWith({
                message: 'Failed to load task: Not found',
                type: 'error',
            });
            consoleError.mockRestore();
        });

        test('should not call API if projectPath is empty', async () => {
            const context = { loading: false, projectPath: '', taskId: 'TASK1' };
            await TaskView.methods.loadTask.call(context);
            expect(global.window.Api.getTask).not.toHaveBeenCalled();
        });

        test('should not call API if taskId is empty', async () => {
            const context = { loading: false, projectPath: '/test', taskId: '' };
            await TaskView.methods.loadTask.call(context);
            expect(global.window.Api.getTask).not.toHaveBeenCalled();
        });
    });

    describe('loadBlueprint', () => {
        test('should load blueprint content from API', async () => {
            global.window.Api.getBlueprint.mockResolvedValue({ content: '# My Blueprint' });

            const context = { blueprintLoading: false, blueprintContent: '', projectPath: '/test', taskId: 'TASK1' };
            await TaskView.methods.loadBlueprint.call(context);

            expect(context.blueprintContent).toBe('# My Blueprint');
            expect(context.blueprintLoading).toBe(false);
        });

        test('should handle string response', async () => {
            global.window.Api.getBlueprint.mockResolvedValue('raw string');

            const context = { blueprintLoading: false, blueprintContent: '', projectPath: '/test', taskId: 'TASK1' };
            await TaskView.methods.loadBlueprint.call(context);

            expect(context.blueprintContent).toBe('raw string');
        });

        test('should show error toast on failure', async () => {
            global.window.Api.getBlueprint.mockRejectedValue(new Error('Load failed'));

            const consoleError = jest.spyOn(console, 'error').mockImplementation();
            const context = { blueprintLoading: false, blueprintContent: '', projectPath: '/test', taskId: 'TASK1' };
            await TaskView.methods.loadBlueprint.call(context);

            expect(context.blueprintContent).toBe('');
            expect(global.window.Store.addToast).toHaveBeenCalledWith({
                message: 'Failed to load blueprint: Load failed',
                type: 'error',
            });
            consoleError.mockRestore();
        });

        test('should not load if projectPath is empty', async () => {
            const context = { blueprintLoading: false, projectPath: '', taskId: 'TASK1' };
            await TaskView.methods.loadBlueprint.call(context);
            expect(global.window.Api.getBlueprint).not.toHaveBeenCalled();
        });
    });

    describe('loadExecution', () => {
        test('should load execution data and raw JSON', async () => {
            const execData = { phases: [{ id: 1 }], artifacts: [] };
            global.window.Api.getExecution.mockResolvedValue(execData);

            const context = { executionLoading: false, executionData: null, executionRaw: '', projectPath: '/test', taskId: 'TASK1' };
            await TaskView.methods.loadExecution.call(context);

            expect(context.executionData).toEqual(execData);
            expect(context.executionRaw).toBe(JSON.stringify(execData, null, 2));
            expect(context.executionLoading).toBe(false);
        });

        test('should set executionData to null on failure', async () => {
            global.window.Api.getExecution.mockRejectedValue(new Error('Exec error'));

            const consoleError = jest.spyOn(console, 'error').mockImplementation();
            const context = { executionLoading: false, executionData: null, executionRaw: '', projectPath: '/test', taskId: 'TASK1' };
            await TaskView.methods.loadExecution.call(context);

            expect(context.executionData).toBeNull();
            expect(global.window.Store.addToast).toHaveBeenCalled();
            consoleError.mockRestore();
        });
    });

    describe('loadReview', () => {
        test('should load review content from API', async () => {
            global.window.Api.getReview.mockResolvedValue({ content: '# Review' });

            const context = { reviewLoading: false, reviewContent: '', projectPath: '/test', taskId: 'TASK1' };
            await TaskView.methods.loadReview.call(context);

            expect(context.reviewContent).toBe('# Review');
            expect(context.reviewLoading).toBe(false);
        });

        test('should not show error toast for missing reviews', async () => {
            global.window.Api.getReview.mockRejectedValue(new Error('Not found'));

            const consoleError = jest.spyOn(console, 'error').mockImplementation();
            const context = { reviewLoading: false, reviewContent: '', projectPath: '/test', taskId: 'TASK1' };
            await TaskView.methods.loadReview.call(context);

            expect(context.reviewContent).toBe('');
            expect(global.window.Store.addToast).not.toHaveBeenCalled();
            consoleError.mockRestore();
        });
    });

    describe('retry', () => {
        test('should call Api.retryTask and reload task', async () => {
            const context = {
                retrying: false,
                projectPath: '/test',
                taskId: 'TASK1',
                loadTask: jest.fn().mockResolvedValue(undefined),
            };

            await TaskView.methods.retry.call(context);

            expect(global.window.Api.retryTask).toHaveBeenCalledWith('/test', 'TASK1');
            expect(global.window.Store.addToast).toHaveBeenCalledWith({
                message: 'Task retry initiated',
                type: 'success',
            });
            expect(context.loadTask).toHaveBeenCalled();
            expect(context.retrying).toBe(false);
        });

        test('should not retry if already retrying', async () => {
            const context = {
                retrying: true,
                projectPath: '/test',
                taskId: 'TASK1',
            };

            await TaskView.methods.retry.call(context);
            expect(global.window.Api.retryTask).not.toHaveBeenCalled();
        });

        test('should show error toast on failure', async () => {
            global.window.Api.retryTask.mockRejectedValue(new Error('Retry failed'));

            const consoleError = jest.spyOn(console, 'error').mockImplementation();
            const context = {
                retrying: false,
                projectPath: '/test',
                taskId: 'TASK1',
                loadTask: jest.fn(),
            };

            await TaskView.methods.retry.call(context);

            expect(global.window.Store.addToast).toHaveBeenCalledWith({
                message: 'Failed to retry task: Retry failed',
                type: 'error',
            });
            expect(context.retrying).toBe(false);
            consoleError.mockRestore();
        });
    });

    describe('approve', () => {
        test('should call Api.approveReview and reload task', async () => {
            const context = {
                approving: false,
                projectPath: '/test',
                taskId: 'TASK1',
                loadTask: jest.fn().mockResolvedValue(undefined),
            };

            await TaskView.methods.approve.call(context);

            expect(global.window.Api.approveReview).toHaveBeenCalledWith('/test', 'TASK1');
            expect(global.window.Store.addToast).toHaveBeenCalledWith({
                message: 'Review approved successfully',
                type: 'success',
            });
            expect(context.loadTask).toHaveBeenCalled();
            expect(context.approving).toBe(false);
        });

        test('should not approve if already approving', async () => {
            const context = {
                approving: true,
                projectPath: '/test',
                taskId: 'TASK1',
            };

            await TaskView.methods.approve.call(context);
            expect(global.window.Api.approveReview).not.toHaveBeenCalled();
        });

        test('should show error toast on failure', async () => {
            global.window.Api.approveReview.mockRejectedValue(new Error('Approve failed'));

            const consoleError = jest.spyOn(console, 'error').mockImplementation();
            const context = {
                approving: false,
                projectPath: '/test',
                taskId: 'TASK1',
                loadTask: jest.fn(),
            };

            await TaskView.methods.approve.call(context);

            expect(global.window.Store.addToast).toHaveBeenCalledWith({
                message: 'Failed to approve review: Approve failed',
                type: 'error',
            });
            expect(context.approving).toBe(false);
            consoleError.mockRestore();
        });
    });

    describe('saveBlueprint', () => {
        test('should call Api.updateBlueprint and show success toast', async () => {
            const context = {
                blueprintContent: '',
                projectPath: '/test',
                taskId: 'TASK1',
            };

            await TaskView.methods.saveBlueprint.call(context, 'new content');

            expect(global.window.Api.updateBlueprint).toHaveBeenCalledWith('/test', 'TASK1', 'new content');
            expect(context.blueprintContent).toBe('new content');
            expect(global.window.Store.addToast).toHaveBeenCalledWith({
                message: 'Blueprint saved successfully',
                type: 'success',
            });
        });

        test('should show error toast on save failure', async () => {
            global.window.Api.updateBlueprint.mockRejectedValue(new Error('Save failed'));

            const consoleError = jest.spyOn(console, 'error').mockImplementation();
            const context = {
                blueprintContent: 'old',
                projectPath: '/test',
                taskId: 'TASK1',
            };

            await TaskView.methods.saveBlueprint.call(context, 'new');

            expect(global.window.Store.addToast).toHaveBeenCalledWith({
                message: 'Failed to save blueprint: Save failed',
                type: 'error',
            });
            consoleError.mockRestore();
        });
    });

    describe('toggleRawExecution', () => {
        test('should toggle showRawExecution', () => {
            const context = { showRawExecution: false };
            TaskView.methods.toggleRawExecution.call(context);
            expect(context.showRawExecution).toBe(true);

            TaskView.methods.toggleRawExecution.call(context);
            expect(context.showRawExecution).toBe(false);
        });
    });

    describe('watch.activeTab', () => {
        test('should trigger loadBlueprint when switching to blueprint tab and content not loaded', () => {
            const context = {
                blueprintContent: '',
                executionData: null,
                reviewContent: '',
                loadBlueprint: jest.fn(),
                loadExecution: jest.fn(),
                loadReview: jest.fn(),
            };

            TaskView.watch.activeTab.call(context, 'blueprint');
            expect(context.loadBlueprint).toHaveBeenCalled();
        });

        test('should trigger loadExecution when switching to execution tab', () => {
            const context = {
                blueprintContent: '',
                executionData: null,
                reviewContent: '',
                loadBlueprint: jest.fn(),
                loadExecution: jest.fn(),
                loadReview: jest.fn(),
            };

            TaskView.watch.activeTab.call(context, 'execution');
            expect(context.loadExecution).toHaveBeenCalled();
        });

        test('should trigger loadReview when switching to review tab', () => {
            const context = {
                blueprintContent: '',
                executionData: null,
                reviewContent: '',
                loadBlueprint: jest.fn(),
                loadExecution: jest.fn(),
                loadReview: jest.fn(),
            };

            TaskView.watch.activeTab.call(context, 'review');
            expect(context.loadReview).toHaveBeenCalled();
        });

        test('should not reload blueprint if already loaded', () => {
            const context = {
                blueprintContent: 'already loaded',
                loadBlueprint: jest.fn(),
            };

            TaskView.watch.activeTab.call(context, 'blueprint');
            expect(context.loadBlueprint).not.toHaveBeenCalled();
        });
    });

    test('should have template with 4 tab sections', () => {
        expect(typeof TaskView.template).toBe('string');
        expect(TaskView.template).toContain('overview');
        expect(TaskView.template).toContain('blueprint');
        expect(TaskView.template).toContain('execution');
        expect(TaskView.template).toContain('review');
        expect(TaskView.template).toContain('retry');
        expect(TaskView.template).toContain('approve');
    });
});
