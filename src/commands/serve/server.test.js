/**
 * Tests for server.js
 * Self-contained tests with internal mocks
 */

const path = require('path');

// Mock express and http modules BEFORE requiring server.js
jest.mock('express', () => {
    const mockApp = {
        use: jest.fn(),
        get: jest.fn(),
    };
    const mockExpress = jest.fn(() => mockApp);
    mockExpress.json = jest.fn(() => 'json-middleware');
    mockExpress.static = jest.fn(() => 'static-middleware');
    return mockExpress;
});

jest.mock('http', () => ({
    createServer: jest.fn(() => ({
        listen: jest.fn(),
        close: jest.fn(),
        on: jest.fn(),
    })),
}));

// Mock API routers
jest.mock('./api/projects', () => jest.fn(() => 'projects-router'));
jest.mock('./api/tasks', () => ({
    createTasksRouter: jest.fn(() => 'tasks-router'),
}));
jest.mock('./api/prompt', () => ({
    createPromptRouter: jest.fn(() => 'prompt-router'),
}));
jest.mock('./api/logs', () => ({
    createLogsRouter: jest.fn(() => 'logs-router'),
}));

// Mock WebSocket handler
jest.mock('./websocket', () => ({
    createWebSocketHandler: jest.fn(() => ({
        handleUpgrade: jest.fn(),
        shutdown: jest.fn(),
        wss: {},
    })),
}));

const { createServer, startServer } = require('./server');
const express = require('express');
const http = require('http');
const createProjectsRouter = require('./api/projects');
const { createTasksRouter: _createTasksRouter } = require('./api/tasks');
const { createPromptRouter: _createPromptRouter } = require('./api/prompt');
const { createLogsRouter: _createLogsRouter } = require('./api/logs');
const { createWebSocketHandler } = require('./websocket');

describe('server', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createServer', () => {
        test('should create Express app with default options', () => {
            const server = createServer();

            expect(express).toHaveBeenCalled();
            expect(server.port).toBe(3000);
            expect(server.host).toBe('localhost');
            expect(http.createServer).toHaveBeenCalled();
        });

        test('should create Express app with custom port and host', () => {
            const server = createServer({ port: 8080, host: '0.0.0.0' });

            expect(server.port).toBe(8080);
            expect(server.host).toBe('0.0.0.0');
        });

        test('should store projectPaths in server object', () => {
            const projectPaths = ['/path/to/project1', '/path/to/project2'];
            const server = createServer({ projectPaths });

            expect(server.projectPaths).toEqual(projectPaths);
        });

        test('should configure Express middleware', () => {
            createServer();

            const app = express();
            expect(app.use).toHaveBeenCalledWith('json-middleware');
            expect(app.use).toHaveBeenCalledWith('static-middleware');
            expect(express.json).toHaveBeenCalled();
            expect(express.static).toHaveBeenCalledWith(
                path.join(__dirname, 'public'),
            );
        });

        test('should mount API routers', () => {
            const projectPaths = ['/path/to/project'];
            createServer({ projectPaths });

            const app = express();
            expect(createProjectsRouter).toHaveBeenCalledWith({ projectPaths });
            expect(app.use).toHaveBeenCalledWith('/api/projects', 'projects-router');
            expect(app.use).toHaveBeenCalledWith('/api/projects/:projectPath/tasks', 'tasks-router');
            expect(app.use).toHaveBeenCalledWith('/api/projects/:projectPath/prompt', 'prompt-router');
            expect(app.use).toHaveBeenCalledWith('/api/projects/:projectPath/logs', 'logs-router');
        });

        test('should create WebSocket handler with project paths', () => {
            const projectPaths = ['/path/to/project'];
            const server = createServer({ projectPaths });

            expect(createWebSocketHandler).toHaveBeenCalledWith({ allowedPaths: projectPaths });
            expect(server.wsHandler).toBeDefined();
            expect(server.wsHandler.handleUpgrade).toBeDefined();
        });

        test('should attach WebSocket upgrade handler to HTTP server', () => {
            const server = createServer();

            expect(server.httpServer.on).toHaveBeenCalledWith('upgrade', expect.any(Function));
        });

        test('should configure SPA fallback route', () => {
            createServer();

            const app = express();
            expect(app.get).toHaveBeenCalledWith('*', expect.any(Function));

            // Test SPA fallback behavior
            const fallbackHandler = app.get.mock.calls[0][1];
            const mockReq = { path: '/some/path' };
            const mockRes = { sendFile: jest.fn() };
            const mockNext = jest.fn();

            fallbackHandler(mockReq, mockRes, mockNext);

            expect(mockRes.sendFile).toHaveBeenCalledWith(
                path.join(__dirname, 'public', 'index.html'),
            );
            expect(mockNext).not.toHaveBeenCalled();
        });

        test('should skip SPA fallback for API routes', () => {
            createServer();

            const app = express();
            const fallbackHandler = app.get.mock.calls[0][1];
            const mockReq = { path: '/api/projects' };
            const mockRes = { sendFile: jest.fn() };
            const mockNext = jest.fn();

            fallbackHandler(mockReq, mockRes, mockNext);

            expect(mockRes.sendFile).not.toHaveBeenCalled();
            expect(mockNext).toHaveBeenCalled();
        });

        test('should skip SPA fallback for WebSocket paths', () => {
            createServer();

            const app = express();
            const fallbackHandler = app.get.mock.calls[0][1];
            const mockReq = { path: '/ws/updates' };
            const mockRes = { sendFile: jest.fn() };
            const mockNext = jest.fn();

            fallbackHandler(mockReq, mockRes, mockNext);

            expect(mockRes.sendFile).not.toHaveBeenCalled();
            expect(mockNext).toHaveBeenCalled();
        });

        test('should add error handling middleware', () => {
            createServer();

            const app = express();
            // Error handler is the last app.use call with 4 args
            const errorHandlerCall = app.use.mock.calls.find(
                call => typeof call[0] === 'function' && call[0].length === 4,
            );
            expect(errorHandlerCall).toBeDefined();

            // Test error handler
            const errorHandler = errorHandlerCall[0];
            const mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            const consoleError = jest.spyOn(console, 'error').mockImplementation();
            errorHandler(new Error('test error'), {}, mockRes, jest.fn());

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Internal server error',
            });
            consoleError.mockRestore();
        });
    });

    describe('startServer', () => {
        test('should start HTTP server and resolve on success', async () => {
            const mockHttpServer = http.createServer();
            const server = { httpServer: mockHttpServer, port: 3000, host: 'localhost' };

            mockHttpServer.listen.mockImplementation((_port, _host, callback) => {
                callback();
            });

            const result = await startServer(server);

            expect(mockHttpServer.on).toHaveBeenCalledWith('error', expect.any(Function));
            expect(mockHttpServer.listen).toHaveBeenCalledWith(3000, 'localhost', expect.any(Function));
            expect(result).toBe(server);
        });

        test('should reject on server binding error', async () => {
            const mockHttpServer = http.createServer();
            const server = { httpServer: mockHttpServer, port: 3000, host: 'localhost' };
            const error = new Error('EADDRINUSE: port already in use');

            let errorHandler;
            mockHttpServer.on = jest.fn((event, handler) => {
                if (event === 'error') {
                    errorHandler = handler;
                }
            });

            mockHttpServer.listen.mockImplementation(() => {
                setImmediate(() => errorHandler(error));
            });

            await expect(startServer(server)).rejects.toThrow('EADDRINUSE');
        });

        test('should bind to custom port and host', async () => {
            const mockHttpServer = http.createServer();
            const server = { httpServer: mockHttpServer, port: 8080, host: '0.0.0.0' };

            mockHttpServer.listen.mockImplementation((_port, _host, callback) => {
                callback();
            });

            await startServer(server);

            expect(mockHttpServer.on).toHaveBeenCalledWith('error', expect.any(Function));
            expect(mockHttpServer.listen).toHaveBeenCalledWith(8080, '0.0.0.0', expect.any(Function));
        });
    });
});
