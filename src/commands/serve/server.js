/**
 * Express Server Setup
 * Creates and configures Express app with static file serving
 */

const express = require('express');
const http = require('http');
const path = require('path');

/**
 * Create Express server with static file serving
 * @param {Object} options - Server configuration
 * @param {number} [options.port=3000] - Port to bind
 * @param {string} [options.host='localhost'] - Host to bind
 * @param {string[]} [options.projectPaths] - Project paths for monitoring (unused here, used by TASK4)
 * @returns {Object} - { app, httpServer, port, host }
 */
const createServer = (options = {}) => {
    const { port = 3000, host = 'localhost', projectPaths } = options;

    const app = express();

    // JSON body parsing for API routes (to be added in TASK1-3)
    app.use(express.json());

    // Static file serving from public/
    app.use(express.static(path.join(__dirname, 'public')));

    // SPA fallback - serve index.html for non-API, non-static routes
    app.get('*', (req, res, next) => {
        // Skip API routes and WebSocket paths
        if (req.path.startsWith('/api/') || req.path.startsWith('/ws')) {
            return next();
        }
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    const httpServer = http.createServer(app);

    return { app, httpServer, port, host, projectPaths };
};

/**
 * Start the HTTP server
 * @param {Object} server - Server object from createServer()
 * @returns {Promise<Object>} - Resolves with server object after binding
 */
const startServer = (server) => {
    return new Promise((resolve, reject) => {
        server.httpServer.listen(server.port, server.host, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve(server);
            }
        });
    });
};

module.exports = { createServer, startServer };
