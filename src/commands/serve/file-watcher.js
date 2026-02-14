/**
 * FileWatcher - Watches .claudiomiro/task-executor/ directory for changes
 * Emits semantic events based on file changes
 */

const { EventEmitter } = require('events');
const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');

class FileWatcher extends EventEmitter {
    constructor() {
        super();
        this.watcher = null;
        this.debounceTimers = new Map();
    }

    /**
     * Start watching the task-executor directory
     * @param {string} projectPath - Root project path
     * @returns {FileWatcher} - Returns this for chaining
     */
    start(projectPath) {
        if (this.watcher) {
            throw new Error('FileWatcher already started');
        }

        const watchPath = path.join(projectPath, '.claudiomiro', 'task-executor');

        // Verify path exists
        if (!fs.existsSync(watchPath)) {
            throw new Error(`Watch path does not exist: ${watchPath}`);
        }

        this.watcher = chokidar.watch(watchPath, {
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: {
                stabilityThreshold: 100,
                pollInterval: 50,
            },
        });

        this.watcher.on('change', (filePath) => this._handleFileChange(filePath));
        this.watcher.on('add', (filePath) => this._handleFileChange(filePath));

        return this;
    }

    /**
     * Stop watching and cleanup
     */
    stop() {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }

        // Clear all pending debounce timers
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
    }

    /**
     * Handle file change with debouncing
     * @param {string} filePath - Full path to changed file
     * @private
     */
    _handleFileChange(filePath) {
        // Clear existing timer for this file
        if (this.debounceTimers.has(filePath)) {
            clearTimeout(this.debounceTimers.get(filePath));
        }

        // Set new timer for 100ms debounce
        const timer = setTimeout(() => {
            this.debounceTimers.delete(filePath);
            const eventData = this._mapToEvent(filePath);
            if (eventData) {
                this.emit(eventData.event, eventData.data);
            }
        }, 100);

        this.debounceTimers.set(filePath, timer);
    }

    /**
     * Map file path to semantic event
     * @param {string} filePath - Full path to changed file
     * @returns {Object|null} - { event, data } or null if no mapping
     * @private
     */
    _mapToEvent(filePath) {
        const fileName = path.basename(filePath);
        const relativePath = filePath;

        // Extract taskId from path (e.g., /path/to/TASK1/execution.json -> TASK1)
        const taskIdMatch = filePath.match(/TASK\d+/);
        const taskId = taskIdMatch ? taskIdMatch[0] : null;

        // Map files to semantic events
        switch (fileName) {
            case 'execution.json':
                if (!taskId) return null;
                // Parse execution.json to include status data
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    const execution = JSON.parse(content);
                    return {
                        event: 'task:status',
                        data: {
                            taskId,
                            ...execution,
                        },
                    };
                } catch (error) {
                    // If parse fails, still emit event without parsed data
                    return {
                        event: 'task:status',
                        data: { taskId, error: 'Failed to parse execution.json' },
                    };
                }

            case 'BLUEPRINT.md':
                if (!taskId) return null;
                return {
                    event: 'task:blueprint',
                    data: { taskId },
                };

            case 'CODE_REVIEW.md':
                if (!taskId) return null;
                return {
                    event: 'task:review',
                    data: { taskId },
                };

            case 'AI_PROMPT.md':
                return {
                    event: 'prompt:changed',
                    data: {},
                };

            case 'done.txt':
                return {
                    event: 'project:completed',
                    data: {},
                };

            default:
                // Any other file change
                return {
                    event: 'file:changed',
                    data: { path: relativePath },
                };
        }
    }
}

module.exports = FileWatcher;
