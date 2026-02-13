/**
 * Claudiomiro Web UI - WebSocket Client
 *
 * Auto-reconnect WebSocket client with exponential backoff.
 * Integrates with Store for reactive updates.
 */

(function (window) {
    'use strict';

    // WebSocket connection
    let ws = null;
    let reconnectAttempts = 0;
    let reconnectTimer = null;
    let currentProjectPath = null;

    // Reconnect configuration
    const INITIAL_RECONNECT_DELAY = 2000; // 2 seconds
    const MAX_RECONNECT_DELAY = 30000; // 30 seconds
    const BACKOFF_MULTIPLIER = 1.5;

    /**
     * Calculate exponential backoff delay
     * @returns {number} Delay in milliseconds
     */
    function getReconnectDelay() {
        const delay = INITIAL_RECONNECT_DELAY * Math.pow(BACKOFF_MULTIPLIER, reconnectAttempts);
        return Math.min(delay, MAX_RECONNECT_DELAY);
    }

    /**
     * Connect to WebSocket server
     * @param {string} projectPath - Project path to subscribe to
     */
    function connect(projectPath) {
        // Store current project path for reconnection
        currentProjectPath = projectPath;

        // Clean up existing connection
        if (ws) {
            ws.onclose = null; // Prevent reconnect on manual close
            ws.close();
            ws = null;
        }

        // Clear any pending reconnect
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }

        // Update connection status
        if (window.Store) {
            window.Store.setConnectionStatus('connecting');
        }

        // Determine WebSocket URL
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}`;

        console.log('[WebSocket] Connecting to', wsUrl);

        try {
            ws = new WebSocket(wsUrl);

            // Connection opened
            ws.onopen = () => {
                console.log('[WebSocket] Connected');
                reconnectAttempts = 0; // Reset reconnect counter

                if (window.Store) {
                    window.Store.setConnectionStatus('connected');
                    window.Store.addToast({
                        message: 'Connected to server',
                        type: 'success',
                        duration: 3000,
                    });
                }

                // Subscribe to project updates
                if (currentProjectPath) {
                    subscribe(currentProjectPath);
                }
            };

            // Message received
            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    handleMessage(message);
                } catch (error) {
                    console.error('[WebSocket] Failed to parse message:', error);
                }
            };

            // Connection closed
            ws.onclose = (event) => {
                console.log('[WebSocket] Disconnected', event.code, event.reason);

                if (window.Store) {
                    window.Store.setConnectionStatus('disconnected');
                }

                ws = null;

                // Attempt reconnect if not a clean close
                if (event.code !== 1000 && currentProjectPath) {
                    scheduleReconnect();
                }
            };

            // Connection error
            ws.onerror = (error) => {
                console.error('[WebSocket] Error:', error);

                if (window.Store) {
                    window.Store.addToast({
                        message: 'WebSocket connection error',
                        type: 'error',
                        duration: 5000,
                    });
                }
            };

        } catch (error) {
            console.error('[WebSocket] Failed to create WebSocket:', error);

            if (window.Store) {
                window.Store.setConnectionStatus('disconnected');
            }

            scheduleReconnect();
        }
    }

    /**
     * Schedule reconnection with exponential backoff
     */
    function scheduleReconnect() {
        if (reconnectTimer) {
            return; // Already scheduled
        }

        const delay = getReconnectDelay();
        reconnectAttempts++;

        console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})...`);

        if (window.Store) {
            window.Store.setConnectionStatus('connecting');
        }

        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            if (currentProjectPath) {
                connect(currentProjectPath);
            }
        }, delay);
    }

    /**
     * Disconnect WebSocket
     */
    function disconnect() {
        currentProjectPath = null;
        reconnectAttempts = 0;

        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }

        if (ws) {
            ws.onclose = null; // Prevent reconnect
            ws.close(1000, 'Client disconnect');
            ws = null;
        }

        if (window.Store) {
            window.Store.setConnectionStatus('disconnected');
        }

        console.log('[WebSocket] Disconnected');
    }

    /**
     * Subscribe to project updates
     * @param {string} projectPath - Project path to subscribe to
     */
    function subscribe(projectPath) {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            console.warn('[WebSocket] Cannot subscribe - not connected');
            return;
        }

        const message = {
            type: 'subscribe',
            projectPath: projectPath,
        };

        ws.send(JSON.stringify(message));
        console.log('[WebSocket] Subscribed to project:', projectPath);
    }

    /**
     * Handle incoming WebSocket message
     * @param {Object} message - Parsed message object
     */
    function handleMessage(message) {
        if (!message.type) {
            console.warn('[WebSocket] Message missing type:', message);
            return;
        }

        console.log('[WebSocket] Message:', message.type, message);

        // Dispatch to Store based on event type
        switch (message.type) {
            case 'task_updated':
                handleTaskUpdated(message);
                break;

            case 'task_created':
                handleTaskCreated(message);
                break;

            case 'task_deleted':
                handleTaskDeleted(message);
                break;

            case 'file_changed':
                handleFileChanged(message);
                break;

            case 'project_state_changed':
                handleProjectStateChanged(message);
                break;

            default:
                console.warn('[WebSocket] Unknown message type:', message.type);
        }
    }

    /**
     * Handle task_updated event
     * @param {Object} message - Message data
     */
    function handleTaskUpdated(message) {
        if (!window.Store || !message.taskId) return;

        // Update task in store
        if (message.task) {
            window.Store.updateTask(message.taskId, message.task);
        }

        // Show toast notification
        window.Store.addToast({
            message: `Task ${message.taskId} updated`,
            type: 'info',
            duration: 3000,
        });
    }

    /**
     * Handle task_created event
     * @param {Object} message - Message data
     */
    function handleTaskCreated(message) {
        if (!window.Store || !message.task) return;

        // Refresh tasks list
        if (currentProjectPath && window.Api) {
            window.Api.getTasks(currentProjectPath)
                .then(tasks => {
                    window.Store.setTasks(tasks);
                })
                .catch(error => {
                    console.error('[WebSocket] Failed to refresh tasks:', error);
                });
        }

        // Show toast notification
        window.Store.addToast({
            message: `New task created: ${message.task.id}`,
            type: 'success',
            duration: 5000,
        });
    }

    /**
     * Handle task_deleted event
     * @param {Object} message - Message data
     */
    function handleTaskDeleted(message) {
        if (!window.Store || !message.taskId) return;

        // Refresh tasks list
        if (currentProjectPath && window.Api) {
            window.Api.getTasks(currentProjectPath)
                .then(tasks => {
                    window.Store.setTasks(tasks);
                })
                .catch(error => {
                    console.error('[WebSocket] Failed to refresh tasks:', error);
                });
        }

        // Show toast notification
        window.Store.addToast({
            message: `Task ${message.taskId} deleted`,
            type: 'warning',
            duration: 3000,
        });
    }

    /**
     * Handle file_changed event
     * @param {Object} message - Message data
     */
    function handleFileChanged(message) {
        if (!window.Store) return;

        // If it's a task file, refresh current task
        if (message.taskId && window.Store.state.currentTask?.id === message.taskId) {
            if (currentProjectPath && window.Api) {
                window.Api.getTask(currentProjectPath, message.taskId)
                    .then(task => {
                        window.Store.setCurrentTask(task);
                    })
                    .catch(error => {
                        console.error('[WebSocket] Failed to refresh task:', error);
                    });
            }
        }

        // Show toast notification for important files
        if (message.file && (message.file.includes('BLUEPRINT') || message.file.includes('execution'))) {
            window.Store.addToast({
                message: `File updated: ${message.file}`,
                type: 'info',
                duration: 3000,
            });
        }
    }

    /**
     * Handle project_state_changed event
     * @param {Object} _message - Message data (unused, we refetch from API)
     */
    function handleProjectStateChanged(_message) {
        if (!window.Store || !currentProjectPath) return;

        // Refresh project state
        if (window.Api) {
            window.Api.getProjectState(currentProjectPath)
                .then(state => {
                    window.Store.setTasks(state.tasks || []);
                })
                .catch(error => {
                    console.error('[WebSocket] Failed to refresh project state:', error);
                });
        }

        // Show toast notification
        window.Store.addToast({
            message: 'Project state updated',
            type: 'info',
            duration: 3000,
        });
    }

    // Export WebSocket client as global object
    window.WsClient = {
        connect,
        disconnect,
        subscribe,
        isConnected: () => ws && ws.readyState === WebSocket.OPEN,
    };

})(window);
