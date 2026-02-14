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

        // Determine WebSocket URL with project query parameter
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}?project=${encodeURIComponent(projectPath)}`;

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
            event: 'subscribe:project',
            data: {
                projectPath: projectPath,
            },
        };

        ws.send(JSON.stringify(message));
        console.log('[WebSocket] Subscribed to project:', projectPath);
    }

    /**
     * Handle incoming WebSocket message
     * @param {Object} message - Parsed message object
     */
    function handleMessage(message) {
        if (!message.event) {
            console.warn('[WebSocket] Message missing event:', message);
            return;
        }

        console.log('[WebSocket] Message:', message.event, message);

        // Dispatch to Store based on event type
        switch (message.event) {
            case 'project:state':
                handleProjectState(message);
                break;

            case 'task:status':
                handleTaskStatus(message);
                break;

            case 'task:blueprint':
                handleTaskBlueprint(message);
                break;

            case 'task:review':
                handleTaskReview(message);
                break;

            case 'prompt:changed':
                handlePromptChanged(message);
                break;

            case 'project:completed':
                handleProjectCompleted(message);
                break;

            case 'file:changed':
                handleFileChanged(message);
                break;

            case 'error':
                handleError(message);
                break;

            default:
                console.warn('[WebSocket] Unknown message event:', message.event);
        }
    }

    /**
     * Handle project:state event (initial state snapshot)
     * @param {Object} message - Message with { event, data: { projectPath, tasks, timestamp } }
     */
    function handleProjectState(message) {
        if (!window.Store || !message.data) return;

        const { tasks } = message.data;

        // Convert tasks object to array for store
        if (tasks && typeof tasks === 'object') {
            const tasksArray = Object.entries(tasks).map(([taskId, execution]) => ({
                id: taskId,
                ...execution,
            }));
            window.Store.setTasks(tasksArray);
        }

        console.log('[WebSocket] Project state loaded:', Object.keys(tasks || {}).length, 'tasks');
    }

    /**
     * Handle task:status event (execution.json changed)
     * @param {Object} message - Message with { event, data: { taskId, projectPath, file, execution } }
     */
    function handleTaskStatus(message) {
        if (!window.Store || !message.data) return;

        const { taskId, execution } = message.data;

        // Update task in store
        if (taskId && execution) {
            const existingTaskIndex = window.Store.state.tasks.findIndex(t => t.id === taskId);
            if (existingTaskIndex >= 0) {
                const updated = [...window.Store.state.tasks];
                updated[existingTaskIndex] = { id: taskId, ...execution };
                window.Store.setTasks(updated);
            } else {
                // New task appeared
                window.Store.setTasks([...window.Store.state.tasks, { id: taskId, ...execution }]);
            }

            // If current task is being viewed, update it
            if (window.Store.state.currentTask?.id === taskId) {
                window.Store.setCurrentTask({ id: taskId, ...execution });
            }
        }

        // Show toast notification
        window.Store.addToast({
            message: `Task ${taskId} status updated: ${execution?.status || 'unknown'}`,
            type: 'info',
            duration: 3000,
        });
    }

    /**
     * Handle task:blueprint event (BLUEPRINT.md changed)
     * @param {Object} message - Message with { event, data: { taskId, projectPath, file, content } }
     */
    function handleTaskBlueprint(message) {
        if (!window.Store || !message.data) return;

        const { taskId } = message.data;

        // Show toast notification
        window.Store.addToast({
            message: `Task ${taskId} blueprint updated`,
            type: 'info',
            duration: 3000,
        });
    }

    /**
     * Handle task:review event (CODE_REVIEW.md or review-checklist.json changed)
     * @param {Object} message - Message with { event, data: { taskId, projectPath, file, content } }
     */
    function handleTaskReview(message) {
        if (!window.Store || !message.data) return;

        const { taskId } = message.data;

        // Show toast notification
        window.Store.addToast({
            message: `Task ${taskId} code review updated`,
            type: 'info',
            duration: 3000,
        });
    }

    /**
     * Handle prompt:changed event (AI_PROMPT.md changed)
     * @param {Object} _message - Message with { event, data: { projectPath, file, content } }
     */
    function handlePromptChanged(_message) {
        if (!window.Store) return;

        // Show toast notification
        window.Store.addToast({
            message: 'AI prompt updated',
            type: 'info',
            duration: 3000,
        });
    }

    /**
     * Handle project:completed event (task executor finished all tasks)
     * @param {Object} _message - Message with { event, data: { projectPath } }
     */
    function handleProjectCompleted(_message) {
        if (!window.Store) return;

        // Show toast notification
        window.Store.addToast({
            message: 'All tasks completed!',
            type: 'success',
            duration: 5000,
        });
    }

    /**
     * Handle file:changed event (generic file change)
     * @param {Object} message - Message with { event, data: { projectPath, file, taskId? } }
     */
    function handleFileChanged(message) {
        if (!window.Store || !message.data) return;

        const { taskId, file } = message.data;

        // If it's a task file, refresh current task
        if (taskId && window.Store.state.currentTask?.id === taskId) {
            if (currentProjectPath && window.Api) {
                window.Api.getTask(currentProjectPath, taskId)
                    .then(task => {
                        window.Store.setCurrentTask(task);
                    })
                    .catch(error => {
                        console.error('[WebSocket] Failed to refresh task:', error);
                    });
            }
        }

        // Show toast notification for important files
        if (file && (file.includes('BLUEPRINT') || file.includes('execution'))) {
            window.Store.addToast({
                message: `File updated: ${file}`,
                type: 'info',
                duration: 3000,
            });
        }
    }

    /**
     * Handle error event from server
     * @param {Object} message - Message with { event: 'error', data: { message } }
     */
    function handleError(message) {
        if (!window.Store || !message.data) return;

        window.Store.addToast({
            message: `WebSocket error: ${message.data.message || 'Unknown error'}`,
            type: 'error',
            duration: 5000,
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
