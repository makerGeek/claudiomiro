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
    })),
}));

const { createServer, startServer } = require('./server');
const express = require('express');
const http = require('http');

describe('server', () => {
    beforeEach(() => {
        // Clear mock calls before each test
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
    });

    describe('startServer', () => {
        test('should start HTTP server and resolve on success', async () => {
            const mockHttpServer = http.createServer();
            const server = { httpServer: mockHttpServer, port: 3000, host: 'localhost' };

            mockHttpServer.listen.mockImplementation((_port, _host, callback) => {
                callback();
            });

            const result = await startServer(server);

            expect(mockHttpServer.listen).toHaveBeenCalledWith(3000, 'localhost', expect.any(Function));
            expect(result).toBe(server);
        });

        test('should reject on server binding error', async () => {
            const mockHttpServer = http.createServer();
            const server = { httpServer: mockHttpServer, port: 3000, host: 'localhost' };
            const error = new Error('EADDRINUSE: port already in use');

            mockHttpServer.listen.mockImplementation((_port, _host, callback) => {
                callback(error);
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

            expect(mockHttpServer.listen).toHaveBeenCalledWith(8080, '0.0.0.0', expect.any(Function));
        });
    });
});
