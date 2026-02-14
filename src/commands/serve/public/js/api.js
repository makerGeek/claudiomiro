/**
 * Claudiomiro Web UI - API Client
 *
 * Fetch wrappers for all REST endpoints with consistent error handling.
 * Returns { success, data } or throws error.
 */

(function (window) {
    'use strict';

    const API_BASE = '/api';

    /**
     * Generic fetch wrapper with error handling
     * @param {string} url - API endpoint URL
     * @param {Object} options - Fetch options
     * @returns {Promise<Object>} Response data
     * @throws {Error} If response is not ok
     */
    async function apiFetch(url, options = {}) {
        try {
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
                ...options,
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                const error = new Error(data.error || 'API request failed');
                error.status = response.status;
                error.data = data;
                throw error;
            }

            return data.data;
        } catch (error) {
            // If it's already our custom error, rethrow it
            if (error.status) {
                throw error;
            }

            // Network error or JSON parse error
            const networkError = new Error('Network error: ' + error.message);
            networkError.originalError = error;
            throw networkError;
        }
    }

    /**
     * GET /api/projects
     * List all available projects
     * @returns {Promise<Array>} Projects array
     */
    async function getProjects() {
        return apiFetch(`${API_BASE}/projects`);
    }

    /**
     * GET /api/projects/:projectPath/state
     * Get full project state (tasks, progress, status)
     * @param {string} projectPath - Encoded project path
     * @returns {Promise<Object>} Project state
     */
    async function getProjectState(projectPath) {
        return apiFetch(`${API_BASE}/projects/${encodeURIComponent(projectPath)}/state`);
    }

    /**
     * GET /api/projects/:projectPath/tasks
     * Get tasks for a project
     * @param {string} projectPath - Encoded project path
     * @returns {Promise<Array>} Tasks array
     */
    async function getTasks(projectPath) {
        return apiFetch(`${API_BASE}/projects/${encodeURIComponent(projectPath)}/tasks`);
    }

    /**
     * GET /api/projects/:projectPath/tasks/:taskId
     * Get full task details
     * @param {string} projectPath - Encoded project path
     * @param {string} taskId - Task ID
     * @returns {Promise<Object>} Task detail
     */
    async function getTask(projectPath, taskId) {
        return apiFetch(`${API_BASE}/projects/${encodeURIComponent(projectPath)}/tasks/${taskId}`);
    }

    /**
     * GET /api/projects/:projectPath/tasks/:taskId/blueprint
     * Get BLUEPRINT.md raw content
     * @param {string} projectPath - Encoded project path
     * @param {string} taskId - Task ID
     * @returns {Promise<Object>} Blueprint content { content: string }
     */
    async function getBlueprint(projectPath, taskId) {
        return apiFetch(`${API_BASE}/projects/${encodeURIComponent(projectPath)}/tasks/${taskId}/blueprint`);
    }

    /**
     * GET /api/projects/:projectPath/tasks/:taskId/execution
     * Get execution.json parsed
     * @param {string} projectPath - Encoded project path
     * @param {string} taskId - Task ID
     * @returns {Promise<Object>} Execution data
     */
    async function getExecution(projectPath, taskId) {
        return apiFetch(`${API_BASE}/projects/${encodeURIComponent(projectPath)}/tasks/${taskId}/execution`);
    }

    /**
     * GET /api/projects/:projectPath/tasks/:taskId/review
     * Get CODE_REVIEW.md content
     * @param {string} projectPath - Encoded project path
     * @param {string} taskId - Task ID
     * @returns {Promise<Object>} Review content { content: string }
     */
    async function getReview(projectPath, taskId) {
        return apiFetch(`${API_BASE}/projects/${encodeURIComponent(projectPath)}/tasks/${taskId}/review`);
    }

    /**
     * GET /api/projects/:projectPath/prompt
     * Get AI_PROMPT.md content
     * @param {string} projectPath - Encoded project path
     * @returns {Promise<Object>} Prompt content { content: string }
     */
    async function getPrompt(projectPath) {
        return apiFetch(`${API_BASE}/projects/${encodeURIComponent(projectPath)}/prompt`);
    }

    /**
     * PUT /api/projects/:projectPath/prompt
     * Update AI_PROMPT.md content
     * @param {string} projectPath - Encoded project path
     * @param {string} content - New prompt content
     * @returns {Promise<Object>} Success response
     */
    async function updatePrompt(projectPath, content) {
        return apiFetch(`${API_BASE}/projects/${encodeURIComponent(projectPath)}/prompt`, {
            method: 'PUT',
            body: JSON.stringify({ content }),
        });
    }

    /**
     * PUT /api/projects/:projectPath/tasks/:taskId/blueprint
     * Update BLUEPRINT.md content
     * @param {string} projectPath - Encoded project path
     * @param {string} taskId - Task ID
     * @param {string} content - New blueprint content
     * @returns {Promise<Object>} Success response
     */
    async function updateBlueprint(projectPath, taskId, content) {
        return apiFetch(`${API_BASE}/projects/${encodeURIComponent(projectPath)}/tasks/${taskId}/blueprint`, {
            method: 'PUT',
            body: JSON.stringify({ content }),
        });
    }

    /**
     * PUT /api/projects/:projectPath/tasks/:taskId/execution
     * Update execution.json (with validation)
     * @param {string} projectPath - Encoded project path
     * @param {string} taskId - Task ID
     * @param {Object} data - New execution data
     * @returns {Promise<Object>} Success response
     */
    async function updateExecution(projectPath, taskId, data) {
        return apiFetch(`${API_BASE}/projects/${encodeURIComponent(projectPath)}/tasks/${taskId}/execution`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    /**
     * POST /api/projects/:projectPath/tasks/:taskId/retry
     * Reset task status to pending, clear error history
     * @param {string} projectPath - Encoded project path
     * @param {string} taskId - Task ID
     * @returns {Promise<Object>} Success response
     */
    async function retryTask(projectPath, taskId) {
        return apiFetch(`${API_BASE}/projects/${encodeURIComponent(projectPath)}/tasks/${taskId}/retry`, {
            method: 'POST',
        });
    }

    /**
     * POST /api/projects/:projectPath/tasks/:taskId/approve-review
     * Mark code review as approved
     * @param {string} projectPath - Encoded project path
     * @param {string} taskId - Task ID
     * @returns {Promise<Object>} Success response
     */
    async function approveReview(projectPath, taskId) {
        return apiFetch(`${API_BASE}/projects/${encodeURIComponent(projectPath)}/tasks/${taskId}/approve-review`, {
            method: 'POST',
        });
    }

    /**
     * GET /api/projects/:projectPath/logs
     * Get recent execution log content
     * @param {string} projectPath - Encoded project path
     * @param {number} lines - Number of lines to return (default: 100)
     * @returns {Promise<Object>} Log content { content: string, lines: number }
     */
    async function getLogs(projectPath, lines = 100) {
        return apiFetch(`${API_BASE}/projects/${encodeURIComponent(projectPath)}/logs?lines=${lines}`);
    }

    // Export API client as global object
    window.Api = {
        getProjects,
        getProjectState,
        getTasks,
        getTask,
        getBlueprint,
        getExecution,
        getReview,
        getPrompt,
        updatePrompt,
        updateBlueprint,
        updateExecution,
        retryTask,
        approveReview,
        getLogs,
    };

})(window);
