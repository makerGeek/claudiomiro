/**
 * WebSocket Handler for Real-time Event Broadcasting
 * Manages per-project client subscriptions and broadcasts FileWatcher events
 */

const { WebSocketServer } = require('ws');
const FileWatcher = require('./file-watcher');
const { validateProjectPath, getTaskExecutorPath } = require('./api/path-utils');
const fs = require('fs');
const path = require('path');
const url = require('url');

/**
 * Create WebSocket upgrade handler
 * @param {Object} options - Configuration options
 * @param {string[]} options.allowedPaths - Array of allowed project paths
 * @returns {Object} - { handleUpgrade, shutdown, wss }
 */
const createWebSocketHandler = (options = {}) => {
    const { allowedPaths = [] } = options;

    const wss = new WebSocketServer({ noServer: true });
    const projectClients = new Map(); // projectPath → Set<WebSocket>
    const projectWatchers = new Map(); // projectPath → FileWatcher

    /**
     * Get initial project state snapshot
     * @param {string} projectPath - Project root path
     * @returns {Object} - State snapshot with all tasks
     */
    const getInitialState = (projectPath) => {
        const taskExecutorPath = getTaskExecutorPath(projectPath);

        try {
            const tasks = fs
                .readdirSync(taskExecutorPath)
                .filter(name => {
                    const fullPath = path.join(taskExecutorPath, name);
                    try {
                        return fs.statSync(fullPath).isDirectory() && /^TASK\d+/.test(name);
                    } catch (error) {
                        // Skip unreadable directories (permission denied, symlink target missing, etc.)
                        return false;
                    }
                })
                .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

            const taskStates = {};
            for (const taskId of tasks) {
                const executionPath = path.join(taskExecutorPath, taskId, 'execution.json');
                if (fs.existsSync(executionPath)) {
                    try {
                        const execution = JSON.parse(fs.readFileSync(executionPath, 'utf8'));
                        taskStates[taskId] = execution;
                    } catch (error) {
                        taskStates[taskId] = { error: 'Failed to parse execution.json' };
                    }
                }
            }

            return {
                projectPath,
                tasks: taskStates,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            return {
                projectPath,
                tasks: {},
                error: 'Failed to read project state',
                timestamp: new Date().toISOString(),
            };
        }
    };

    /**
     * Broadcast event to all clients subscribed to a project
     * @param {string} projectPath - Project path
     * @param {string} event - Event name
     * @param {Object} data - Event data
     */
    const broadcast = (projectPath, event, data) => {
        const clients = projectClients.get(projectPath);
        if (!clients) return;

        const message = JSON.stringify({ event, data });

        clients.forEach(client => {
            if (client.readyState === 1) { // WebSocket.OPEN
                client.send(message);
            }
        });
    };

    /**
     * Subscribe a client to a project
     * @param {WebSocket} ws - WebSocket client
     * @param {string} projectPath - Project path
     */
    const subscribeClient = (ws, projectPath) => {
        // Unsubscribe from previous project if any
        if (ws.currentProject) {
            unsubscribeClient(ws, ws.currentProject);
        }

        // Add client to project subscribers
        if (!projectClients.has(projectPath)) {
            projectClients.set(projectPath, new Set());
        }
        projectClients.get(projectPath).add(ws);
        ws.currentProject = projectPath;

        // Start FileWatcher if this is the first client for this project
        if (!projectWatchers.has(projectPath)) {
            const watcher = new FileWatcher();

            try {
                watcher.start(projectPath);
                projectWatchers.set(projectPath, watcher);

                // Listen to all FileWatcher events and broadcast them (AFTER successful start)
                const eventTypes = [
                    'task:status',
                    'task:blueprint',
                    'task:review',
                    'prompt:changed',
                    'project:completed',
                    'file:changed',
                ];

                eventTypes.forEach(eventType => {
                    watcher.on(eventType, (data) => {
                        broadcast(projectPath, eventType, data);
                    });
                });
            } catch (error) {
                // If watcher fails to start, no listeners attached (no memory leak)
                console.error(`Failed to start FileWatcher for ${projectPath}:`, error.message);
            }
        }

        // Send initial state snapshot
        const initialState = getInitialState(projectPath);
        ws.send(JSON.stringify({ event: 'project:state', data: initialState }));
    };

    /**
     * Unsubscribe a client from a project
     * @param {WebSocket} ws - WebSocket client
     * @param {string} projectPath - Project path
     */
    const unsubscribeClient = (ws, projectPath) => {
        const clients = projectClients.get(projectPath);
        if (!clients) return;

        clients.delete(ws);

        // Stop FileWatcher if no more clients for this project
        if (clients.size === 0) {
            projectClients.delete(projectPath);

            const watcher = projectWatchers.get(projectPath);
            if (watcher) {
                watcher.stop();
                projectWatchers.delete(projectPath);
            }
        }
    };

    /**
     * Handle WebSocket connection
     * @param {WebSocket} ws - WebSocket client
     * @param {http.IncomingMessage} req - HTTP request
     */
    const handleConnection = (ws, req) => {
        const { query } = url.parse(req.url, true);
        const projectPath = query.project ? decodeURIComponent(query.project) : '';

        // Validate project path
        const validation = validateProjectPath(projectPath, allowedPaths);
        if (!validation.valid) {
            ws.send(JSON.stringify({
                event: 'error',
                data: { message: 'Invalid project path' },
            }));
            ws.close();
            return;
        }

        // Subscribe client to project
        subscribeClient(ws, validation.resolvedPath);

        // Handle incoming messages
        ws.on('message', (message) => {
            try {
                const { event, data } = JSON.parse(message.toString());

                // Validate event field exists
                if (!event) return;

                if (event === 'subscribe:project') {
                    const newProjectPath = data.projectPath || '';
                    const newValidation = validateProjectPath(newProjectPath, allowedPaths);

                    if (newValidation.valid) {
                        subscribeClient(ws, newValidation.resolvedPath);
                    } else {
                        ws.send(JSON.stringify({
                            event: 'error',
                            data: { message: 'Invalid project path' },
                        }));
                    }
                }
            } catch (error) {
                console.error('WebSocket message parsing error:', error.message);
            }
        });

        // Handle client disconnect
        ws.on('close', () => {
            if (ws.currentProject) {
                unsubscribeClient(ws, ws.currentProject);
            }
        });
    };

    // Attach connection handler
    wss.on('connection', handleConnection);

    /**
     * HTTP upgrade handler for WebSocket connections
     * @param {http.IncomingMessage} request - HTTP request
     * @param {net.Socket} socket - Network socket
     * @param {Buffer} head - First packet of upgraded stream
     */
    const handleUpgrade = (request, socket, head) => {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    };

    /**
     * Shutdown all watchers and connections
     */
    const shutdown = () => {
        // Stop all watchers
        projectWatchers.forEach(watcher => watcher.stop());
        projectWatchers.clear();

        // Close all connections
        wss.clients.forEach(client => client.close());
        projectClients.clear();

        // Close WebSocket server
        wss.close();
    };

    return {
        handleUpgrade,
        shutdown,
        wss,
    };
};

module.exports = { createWebSocketHandler };
