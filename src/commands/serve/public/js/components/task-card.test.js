/**
 * Tests for TaskCard component
 */

beforeAll(() => {
    if (typeof global.window === 'undefined') {
        global.window = global;
    }
});

describe('TaskCard', () => {
    let TaskCard;
    let savedRouter;

    beforeEach(() => {
        jest.resetModules();
        savedRouter = global.window.Router;
        delete global.window.TaskCard;
        require('./task-card');
        TaskCard = global.window.TaskCard;
    });

    afterEach(() => {
        if (savedRouter !== undefined) {
            global.window.Router = savedRouter;
        } else {
            delete global.window.Router;
        }
    });

    test('should be defined on window', () => {
        expect(TaskCard).toBeDefined();
        expect(TaskCard.name).toBe('TaskCard');
    });

    test('should have required task prop and optional projectPath prop', () => {
        expect(TaskCard.props.task.type).toBe(Object);
        expect(TaskCard.props.task.required).toBe(true);
        expect(TaskCard.props.projectPath.type).toBe(String);
        expect(TaskCard.props.projectPath.default).toBe('');
    });

    describe('title computed', () => {
        function getTitle(task) {
            return TaskCard.computed.title.call({ task });
        }

        test('should return task.title when available', () => {
            expect(getTitle({ title: 'My Task', id: 'TASK1' })).toBe('My Task');
        });

        test('should fallback to task.id when title is absent', () => {
            expect(getTitle({ id: 'TASK1' })).toBe('TASK1');
        });

        test('should return "Untitled" when both title and id are absent', () => {
            expect(getTitle({})).toBe('Untitled');
        });
    });

    describe('currentStep computed', () => {
        function getCurrentStep(task) {
            return TaskCard.computed.currentStep.call({ task });
        }

        test('should return phase name when currentPhase has name', () => {
            expect(getCurrentStep({ currentPhase: { name: 'Implementation', id: 2 } })).toBe('Implementation');
        });

        test('should return "Phase N" when currentPhase has no name', () => {
            expect(getCurrentStep({ currentPhase: { id: 3 } })).toBe('Phase 3');
        });

        test('should return null when no currentPhase', () => {
            expect(getCurrentStep({})).toBeNull();
        });
    });

    describe('progressPercent computed', () => {
        function getProgress(task) {
            return TaskCard.computed.progressPercent.call({ task });
        }

        test('should return 0 when phases is empty array', () => {
            expect(getProgress({ phases: [] })).toBe(0);
        });

        test('should return 0 when phases is undefined', () => {
            expect(getProgress({})).toBe(0);
        });

        test('should return 0 when phases is null', () => {
            expect(getProgress({ phases: null })).toBe(0);
        });

        test('should calculate correct percentage', () => {
            const task = {
                phases: [
                    { status: 'completed' },
                    { status: 'completed' },
                    { status: 'in_progress' },
                    { status: 'pending' },
                ],
            };
            expect(getProgress(task)).toBe(50);
        });

        test('should return 100 when all phases completed', () => {
            const task = {
                phases: [
                    { status: 'completed' },
                    { status: 'completed' },
                ],
            };
            expect(getProgress(task)).toBe(100);
        });

        test('should return 0 when no phases completed', () => {
            const task = {
                phases: [
                    { status: 'pending' },
                    { status: 'pending' },
                ],
            };
            expect(getProgress(task)).toBe(0);
        });

        test('should round to nearest integer', () => {
            const task = {
                phases: [
                    { status: 'completed' },
                    { status: 'pending' },
                    { status: 'pending' },
                ],
            };
            expect(getProgress(task)).toBe(33);
        });
    });

    describe('taskUrl computed', () => {
        test('should return Router.taskUrl when Router and projectPath exist', () => {
            global.window.Router = {
                taskUrl: jest.fn().mockReturnValue('#/project/myproj/task/TASK1'),
            };
            const context = { projectPath: '/my/project', task: { id: 'TASK1' } };
            const result = TaskCard.computed.taskUrl.call(context);

            expect(global.window.Router.taskUrl).toHaveBeenCalledWith('/my/project', 'TASK1');
            expect(result).toBe('#/project/myproj/task/TASK1');
        });

        test('should return "#" when Router is not available', () => {
            delete global.window.Router;
            const context = { projectPath: '/my/project', task: { id: 'TASK1' } };
            const result = TaskCard.computed.taskUrl.call(context);
            expect(result).toBe('#');
        });

        test('should return "#" when projectPath is empty', () => {
            global.window.Router = { taskUrl: jest.fn() };
            const context = { projectPath: '', task: { id: 'TASK1' } };
            const result = TaskCard.computed.taskUrl.call(context);
            expect(result).toBe('#');
        });
    });

    describe('dependencies computed', () => {
        test('should return task.dependencies when available', () => {
            const context = { task: { dependencies: ['TASK1', 'TASK2'] } };
            const result = TaskCard.computed.dependencies.call(context);
            expect(result).toEqual(['TASK1', 'TASK2']);
        });

        test('should return empty array when no dependencies', () => {
            const context = { task: {} };
            const result = TaskCard.computed.dependencies.call(context);
            expect(result).toEqual([]);
        });
    });
});
