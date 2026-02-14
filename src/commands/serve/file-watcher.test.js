/**
 * Tests for FileWatcher class
 */

const FileWatcher = require('./file-watcher');
const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');

// Mock chokidar
jest.mock('chokidar');
const chokidar = require('chokidar');

// Mock fs
jest.mock('fs');

describe('FileWatcher', () => {
    let fileWatcher;
    let mockWatcher;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        jest.useFakeTimers();

        // Create mock watcher (EventEmitter-like)
        mockWatcher = new EventEmitter();
        mockWatcher.close = jest.fn();

        // Mock chokidar.watch to return our mock watcher
        chokidar.watch = jest.fn().mockReturnValue(mockWatcher);

        // Mock fs.existsSync to return true by default
        fs.existsSync.mockReturnValue(true);

        // Mock fs.readFileSync for execution.json
        fs.readFileSync.mockReturnValue(JSON.stringify({
            status: 'in_progress',
            task: 'TASK1',
        }));

        // Create fresh FileWatcher instance
        fileWatcher = new FileWatcher();
    });

    afterEach(() => {
        // Cleanup
        if (fileWatcher) {
            fileWatcher.stop();
        }
        jest.useRealTimers();
    });

    describe('constructor', () => {
        test('should initialize with null watcher and empty debounceTimers Map', () => {
            expect(fileWatcher.watcher).toBeNull();
            expect(fileWatcher.debounceTimers).toBeInstanceOf(Map);
            expect(fileWatcher.debounceTimers.size).toBe(0);
        });

        test('should extend EventEmitter', () => {
            expect(fileWatcher).toBeInstanceOf(EventEmitter);
        });
    });

    describe('start()', () => {
        test('should create watcher on correct path with correct options', () => {
            const projectPath = '/test/project';
            const expectedWatchPath = path.join(projectPath, '.claudiomiro', 'task-executor');

            fileWatcher.start(projectPath);

            expect(chokidar.watch).toHaveBeenCalledWith(expectedWatchPath, {
                persistent: true,
                ignoreInitial: true,
                awaitWriteFinish: {
                    stabilityThreshold: 100,
                    pollInterval: 50,
                },
            });
        });

        test('should set up event listeners for change and add', () => {
            fileWatcher.start('/test/project');

            expect(mockWatcher.listeners('change').length).toBe(1);
            expect(mockWatcher.listeners('add').length).toBe(1);
        });

        test('should return this for chaining', () => {
            const result = fileWatcher.start('/test/project');
            expect(result).toBe(fileWatcher);
        });

        test('should throw error if watcher already started', () => {
            fileWatcher.start('/test/project');
            expect(() => fileWatcher.start('/test/project')).toThrow('FileWatcher already started');
        });

        test('should throw error if watch path does not exist', () => {
            fs.existsSync.mockReturnValue(false);
            expect(() => fileWatcher.start('/nonexistent')).toThrow('Watch path does not exist');
        });
    });

    describe('stop()', () => {
        test('should close watcher and set to null', () => {
            fileWatcher.start('/test/project');
            fileWatcher.stop();

            expect(mockWatcher.close).toHaveBeenCalled();
            expect(fileWatcher.watcher).toBeNull();
        });

        test('should clear all debounce timers', () => {
            fileWatcher.start('/test/project');

            // Trigger some file changes to create debounce timers
            mockWatcher.emit('change', '/test/project/.claudiomiro/task-executor/TASK1/execution.json');
            mockWatcher.emit('change', '/test/project/.claudiomiro/task-executor/TASK2/execution.json');

            expect(fileWatcher.debounceTimers.size).toBe(2);

            fileWatcher.stop();

            expect(fileWatcher.debounceTimers.size).toBe(0);
        });

        test('should not throw if called when watcher is null', () => {
            expect(() => fileWatcher.stop()).not.toThrow();
        });
    });

    describe('debounce behavior', () => {
        test('should debounce rapid file changes', () => {
            fileWatcher.start('/test/project');
            const emitSpy = jest.spyOn(fileWatcher, 'emit');

            const filePath = '/test/project/.claudiomiro/task-executor/TASK1/execution.json';

            // Emit change 3 times rapidly
            mockWatcher.emit('change', filePath);
            mockWatcher.emit('change', filePath);
            mockWatcher.emit('change', filePath);

            // Should not emit yet
            expect(emitSpy).not.toHaveBeenCalled();

            // Advance timers by 100ms
            jest.advanceTimersByTime(100);

            // Should emit only once
            expect(emitSpy).toHaveBeenCalledTimes(1);
            expect(emitSpy).toHaveBeenCalledWith('task:status', expect.objectContaining({
                taskId: 'TASK1',
            }));
        });

        test('should handle multiple files changing independently', () => {
            fileWatcher.start('/test/project');
            const emitSpy = jest.spyOn(fileWatcher, 'emit');

            const file1 = '/test/project/.claudiomiro/task-executor/TASK1/execution.json';
            const file2 = '/test/project/.claudiomiro/task-executor/TASK2/execution.json';

            mockWatcher.emit('change', file1);
            mockWatcher.emit('change', file2);

            jest.advanceTimersByTime(100);

            expect(emitSpy).toHaveBeenCalledTimes(2);
        });
    });

    describe('semantic event mapping', () => {
        beforeEach(() => {
            fileWatcher.start('/test/project');
        });

        test('should map execution.json to task:status event', () => {
            const emitSpy = jest.spyOn(fileWatcher, 'emit');
            const filePath = '/test/project/.claudiomiro/task-executor/TASK1/execution.json';

            mockWatcher.emit('change', filePath);
            jest.advanceTimersByTime(100);

            expect(emitSpy).toHaveBeenCalledWith('task:status', expect.objectContaining({
                taskId: 'TASK1',
                status: 'in_progress',
                task: 'TASK1',
            }));
        });

        test('should map BLUEPRINT.md to task:blueprint event', () => {
            const emitSpy = jest.spyOn(fileWatcher, 'emit');
            const filePath = '/test/project/.claudiomiro/task-executor/TASK1/BLUEPRINT.md';

            mockWatcher.emit('change', filePath);
            jest.advanceTimersByTime(100);

            expect(emitSpy).toHaveBeenCalledWith('task:blueprint', { taskId: 'TASK1' });
        });

        test('should map CODE_REVIEW.md to task:review event', () => {
            const emitSpy = jest.spyOn(fileWatcher, 'emit');
            const filePath = '/test/project/.claudiomiro/task-executor/TASK1/CODE_REVIEW.md';

            mockWatcher.emit('change', filePath);
            jest.advanceTimersByTime(100);

            expect(emitSpy).toHaveBeenCalledWith('task:review', { taskId: 'TASK1' });
        });

        test('should map AI_PROMPT.md to prompt:changed event', () => {
            const emitSpy = jest.spyOn(fileWatcher, 'emit');
            const filePath = '/test/project/.claudiomiro/task-executor/AI_PROMPT.md';

            mockWatcher.emit('change', filePath);
            jest.advanceTimersByTime(100);

            expect(emitSpy).toHaveBeenCalledWith('prompt:changed', {});
        });

        test('should map done.txt to project:completed event', () => {
            const emitSpy = jest.spyOn(fileWatcher, 'emit');
            const filePath = '/test/project/.claudiomiro/task-executor/done.txt';

            mockWatcher.emit('add', filePath);
            jest.advanceTimersByTime(100);

            expect(emitSpy).toHaveBeenCalledWith('project:completed', {});
        });

        test('should map other files to file:changed event', () => {
            const emitSpy = jest.spyOn(fileWatcher, 'emit');
            const filePath = '/test/project/.claudiomiro/task-executor/TASK1/some-other-file.txt';

            mockWatcher.emit('change', filePath);
            jest.advanceTimersByTime(100);

            expect(emitSpy).toHaveBeenCalledWith('file:changed', { path: filePath });
        });
    });

    describe('taskId extraction', () => {
        beforeEach(() => {
            fileWatcher.start('/test/project');
        });

        test('should extract taskId from path', () => {
            const emitSpy = jest.spyOn(fileWatcher, 'emit');
            const filePath = '/test/project/.claudiomiro/task-executor/TASK123/BLUEPRINT.md';

            mockWatcher.emit('change', filePath);
            jest.advanceTimersByTime(100);

            expect(emitSpy).toHaveBeenCalledWith('task:blueprint', { taskId: 'TASK123' });
        });

        test('should handle files without taskId gracefully', () => {
            const emitSpy = jest.spyOn(fileWatcher, 'emit');
            const filePath = '/test/project/.claudiomiro/task-executor/AI_PROMPT.md';

            mockWatcher.emit('change', filePath);
            jest.advanceTimersByTime(100);

            expect(emitSpy).toHaveBeenCalledWith('prompt:changed', {});
        });
    });

    describe('error handling', () => {
        beforeEach(() => {
            fileWatcher.start('/test/project');
        });

        test('should handle malformed execution.json gracefully', () => {
            const emitSpy = jest.spyOn(fileWatcher, 'emit');
            const filePath = '/test/project/.claudiomiro/task-executor/TASK1/execution.json';

            // Mock readFileSync to return invalid JSON
            fs.readFileSync.mockReturnValue('invalid json {');

            mockWatcher.emit('change', filePath);
            jest.advanceTimersByTime(100);

            expect(emitSpy).toHaveBeenCalledWith('task:status', {
                taskId: 'TASK1',
                error: 'Failed to parse execution.json',
            });
        });

        test('should handle fs.readFileSync errors gracefully', () => {
            const emitSpy = jest.spyOn(fileWatcher, 'emit');
            const filePath = '/test/project/.claudiomiro/task-executor/TASK1/execution.json';

            // Mock readFileSync to throw error
            fs.readFileSync.mockImplementation(() => {
                throw new Error('File read error');
            });

            mockWatcher.emit('change', filePath);
            jest.advanceTimersByTime(100);

            expect(emitSpy).toHaveBeenCalledWith('task:status', {
                taskId: 'TASK1',
                error: 'Failed to parse execution.json',
            });
        });
    });
});
