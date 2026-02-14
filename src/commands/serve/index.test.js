/**
 * Tests for index.js
 * Self-contained tests with internal mocks
 */

// Mock chalk before requiring index
jest.mock('chalk', () => ({
    cyan: jest.fn(str => str),
    green: jest.fn(str => str),
    white: jest.fn(str => str),
    gray: jest.fn(str => str),
    yellow: jest.fn(str => str),
    red: jest.fn(str => str),
}));

// Mock server module
jest.mock('./server', () => ({
    createServer: jest.fn(),
    startServer: jest.fn(),
}));

const { parseArgs, run } = require('./index');
const { createServer, startServer } = require('./server');

describe('serve command', () => {
    let consoleLog;
    let consoleError;
    let processExit;
    let processOn;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Mock console methods
        consoleLog = jest.spyOn(console, 'log').mockImplementation();
        consoleError = jest.spyOn(console, 'error').mockImplementation();

        // Mock process methods
        processExit = jest.spyOn(process, 'exit').mockImplementation();
        processOn = jest.spyOn(process, 'on').mockImplementation();

        // Default mock implementations
        createServer.mockReturnValue({
            httpServer: { close: jest.fn() },
            host: 'localhost',
            port: 3000,
            wsHandler: { shutdown: jest.fn() },
        });
        startServer.mockImplementation(server => Promise.resolve(server));
    });

    afterEach(() => {
        consoleLog.mockRestore();
        consoleError.mockRestore();
        processExit.mockRestore();
        processOn.mockRestore();
    });

    describe('parseArgs', () => {
        test('should return default options for empty args', () => {
            const options = parseArgs([]);

            expect(options).toEqual({
                port: 3000,
                host: 'localhost',
                open: false,
                projects: [],
                folder: process.cwd(),
            });
        });

        test('should parse --port flag', () => {
            const options = parseArgs(['--port=8080']);

            expect(options.port).toBe(8080);
        });

        test('should parse --host flag', () => {
            const options = parseArgs(['--host=0.0.0.0']);

            expect(options.host).toBe('0.0.0.0');
        });

        test('should parse --open flag', () => {
            const options = parseArgs(['--open']);

            expect(options.open).toBe(true);
        });

        test('should parse --projects flag with multiple paths', () => {
            const options = parseArgs(['--projects=/path/to/proj1,/path/to/proj2']);

            expect(options.projects).toEqual(['/path/to/proj1', '/path/to/proj2']);
        });

        test('should parse folder argument', () => {
            const options = parseArgs(['/path/to/folder']);

            expect(options.folder).toBe('/path/to/folder');
        });

        test('should parse multiple flags together', () => {
            const options = parseArgs([
                '--port=5000',
                '--host=127.0.0.1',
                '--open',
                '--projects=/proj1,/proj2',
                '/my/folder',
            ]);

            expect(options).toEqual({
                port: 5000,
                host: '127.0.0.1',
                open: true,
                projects: ['/proj1', '/proj2'],
                folder: '/my/folder',
            });
        });

        test('should trim whitespace from project paths', () => {
            const options = parseArgs(['--projects=/proj1 , /proj2 , /proj3']);

            expect(options.projects).toEqual(['/proj1', '/proj2', '/proj3']);
        });

        test('should handle empty projects list', () => {
            const options = parseArgs(['--projects=']);

            expect(options.projects).toEqual(['']);
        });
    });

    describe('run', () => {
        test('should start server with default options', async () => {
            await run([]);

            expect(createServer).toHaveBeenCalledWith({
                port: 3000,
                host: 'localhost',
                projectPaths: [process.cwd()],
            });
            expect(startServer).toHaveBeenCalled();
            expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Starting'));
            expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Server started'));
        });

        test('should start server with custom port and host', async () => {
            createServer.mockReturnValue({
                httpServer: { close: jest.fn() },
                host: '0.0.0.0',
                port: 8080,
                wsHandler: { shutdown: jest.fn() },
            });

            await run(['--port=8080', '--host=0.0.0.0']);

            expect(createServer).toHaveBeenCalledWith({
                port: 8080,
                host: '0.0.0.0',
                projectPaths: [process.cwd()],
            });
        });

        test('should use projects array when provided', async () => {
            await run(['--projects=/proj1,/proj2']);

            expect(createServer).toHaveBeenCalledWith({
                port: 3000,
                host: 'localhost',
                projectPaths: ['/proj1', '/proj2'],
            });
        });

        test('should use folder as projectPaths when no projects flag', async () => {
            await run(['/my/folder']);

            expect(createServer).toHaveBeenCalledWith({
                port: 3000,
                host: 'localhost',
                projectPaths: ['/my/folder'],
            });
        });

        test('should log startup messages with URL', async () => {
            await run([]);

            expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Starting Claudiomiro Web UI'));
            expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Server started successfully'));
            expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('http://localhost:3000'));
            expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Press Ctrl+C to stop'));
        });

        test('should log opening browser message when --open flag is set', async () => {
            await run(['--open']);

            expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Opening browser'));
        });

        test('should not log opening browser message when --open flag is not set', async () => {
            await run([]);

            const openingBrowserCall = consoleLog.mock.calls.find(
                call => call[0] && call[0].includes('Opening browser'),
            );
            expect(openingBrowserCall).toBeUndefined();
        });

        test('should handle server startup error', async () => {
            const error = new Error('EADDRINUSE: port already in use');
            startServer.mockRejectedValue(error);

            await run([]);

            expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('Failed to start server'));
            expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('port already in use'));
            expect(processExit).toHaveBeenCalledWith(1);
        });

        test('should set up SIGINT and SIGTERM handlers', async () => {
            await run([]);

            expect(processOn).toHaveBeenCalledWith('SIGINT', expect.any(Function));
            expect(processOn).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
        });

        test('should gracefully shutdown on SIGINT', async () => {
            const mockShutdown = jest.fn();
            const mockClose = jest.fn(callback => callback());
            createServer.mockReturnValue({
                httpServer: { close: mockClose },
                host: 'localhost',
                port: 3000,
                wsHandler: { shutdown: mockShutdown },
            });

            let sigintHandler;
            processOn.mockImplementation((event, handler) => {
                if (event === 'SIGINT') {
                    sigintHandler = handler;
                }
            });

            await run([]);

            // Trigger SIGINT
            expect(sigintHandler).toBeDefined();
            sigintHandler();

            expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Shutting down'));
            expect(mockShutdown).toHaveBeenCalled();
            expect(mockClose).toHaveBeenCalled();
            expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Server stopped'));
            expect(processExit).toHaveBeenCalledWith(0);
        });

        test('should gracefully shutdown on SIGTERM', async () => {
            const mockShutdown = jest.fn();
            const mockClose = jest.fn(callback => callback());
            createServer.mockReturnValue({
                httpServer: { close: mockClose },
                host: 'localhost',
                port: 3000,
                wsHandler: { shutdown: mockShutdown },
            });

            let sigtermHandler;
            processOn.mockImplementation((event, handler) => {
                if (event === 'SIGTERM') {
                    sigtermHandler = handler;
                }
            });

            await run([]);

            expect(sigtermHandler).toBeDefined();
            sigtermHandler();

            expect(mockShutdown).toHaveBeenCalled();
            expect(mockClose).toHaveBeenCalled();
        });

        test('should handle shutdown when wsHandler is not present', async () => {
            const mockClose = jest.fn(callback => callback());
            createServer.mockReturnValue({
                httpServer: { close: mockClose },
                host: 'localhost',
                port: 3000,
            });

            let sigintHandler;
            processOn.mockImplementation((event, handler) => {
                if (event === 'SIGINT') {
                    sigintHandler = handler;
                }
            });

            await run([]);

            // Should not throw when wsHandler is missing
            expect(() => sigintHandler()).not.toThrow();
            expect(mockClose).toHaveBeenCalled();
        });
    });
});
