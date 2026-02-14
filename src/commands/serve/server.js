/**
 * Express Server Setup
 * Creates and configures Express app with API routes, WebSocket, and static file serving
 */

const express = require('express');
const http = require('http');
const path = require('path');
const createProjectsRouter = require('./api/projects');
const { createTasksRouter } = require('./api/tasks');
const { createPromptRouter } = require('./api/prompt');
const { createLogsRouter } = require('./api/logs');
const { createWebSocketHandler } = require('./websocket');

/**
 * Create Express server with API routes, WebSocket, and static file serving
 * @param {Object} options - Server configuration
 * @param {number} [options.port=3000] - Port to bind
 * @param {string} [options.host='localhost'] - Host to bind
 * @param {string[]} [options.projectPaths] - Project paths for monitoring
 * @returns {Object} - { app, httpServer, port, host, wsHandler }
 */
const createServer = (options = {}) => {
    const { port = 3000, host = 'localhost', projectPaths = [] } = options;

    const app = express();

    // JSON body parsing for API routes
    app.use(express.json());

    // Mount API routers
    app.use('/api/projects', createProjectsRouter({ projectPaths }));
    app.use('/api/projects/:projectPath/tasks', createTasksRouter());
    app.use('/api/projects/:projectPath/prompt', createPromptRouter());
    app.use('/api/projects/:projectPath/logs', createLogsRouter());

    // Static file serving from public/
    app.use(express.static(path.join(__dirname, 'public')));

    // SPA fallback - serve index.html for non-API, non-static routes
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api/') || req.path.startsWith('/ws')) {
            return next();
        }
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    // Error handling middleware
    app.use((err, _req, res, _next) => {
        console.error('Server error:', err.message);
        res.status(500).json({ success: false, error: 'Internal server error' });
    });

    const httpServer = http.createServer(app);

    // Create WebSocket handler and attach upgrade to HTTP server
    const wsHandler = createWebSocketHandler({ allowedPaths: projectPaths });
    httpServer.on('upgrade', (request, socket, head) => {
        wsHandler.handleUpgrade(request, socket, head);
    });

    return { app, httpServer, port, host, projectPaths, wsHandler };
};

/**
 * Start the HTTP server
 * @param {Object} server - Server object from createServer()
 * @returns {Promise<Object>} - Resolves with server object after binding
 */
const startServer = (server) => {
    return new Promise((resolve, reject) => {
        server.httpServer.on('error', reject);
        server.httpServer.listen(server.port, server.host, () => {
            resolve(server);
        });
    });
};

module.exports = { createServer, startServer };
