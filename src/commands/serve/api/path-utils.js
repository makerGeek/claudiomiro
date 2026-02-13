/**
 * Path Utilities for Serve API
 * Shared path validation and response helpers for all API routes
 */

const fs = require('fs');
const path = require('path');

/**
 * Validate and resolve a project path
 * @param {string} projectPath - The project path to validate
 * @param {string[]} allowedPaths - Array of allowed project paths (optional)
 * @returns {{valid: boolean, error?: string, resolvedPath?: string}}
 */
const validateProjectPath = (projectPath, allowedPaths = []) => {
    try {
        // Decode URL-encoded path
        const decodedPath = decodeURIComponent(projectPath);

        // Security: Reject paths containing ".." (path traversal attack)
        if (decodedPath.includes('..')) {
            return {
                valid: false,
                error: 'Path traversal detected - paths containing ".." are not allowed',
            };
        }

        // Resolve to absolute path
        const resolvedPath = path.resolve(decodedPath);

        // If allowedPaths is provided, verify the path is in the list
        if (allowedPaths.length > 0) {
            const isAllowed = allowedPaths.some(allowedPath => {
                const resolvedAllowed = path.resolve(allowedPath);
                return resolvedPath === resolvedAllowed || resolvedPath.startsWith(resolvedAllowed + path.sep);
            });

            if (!isAllowed) {
                return {
                    valid: false,
                    error: 'Project path is not in the allowed paths list',
                };
            }
        }

        // Verify the path exists
        if (!fs.existsSync(resolvedPath)) {
            return {
                valid: false,
                error: 'Project path does not exist',
            };
        }

        // Verify it's a directory
        const stats = fs.statSync(resolvedPath);
        if (!stats.isDirectory()) {
            return {
                valid: false,
                error: 'Project path is not a directory',
            };
        }

        // Verify .claudiomiro/task-executor/ exists in the project
        const taskExecutorPath = path.join(resolvedPath, '.claudiomiro', 'task-executor');
        if (!fs.existsSync(taskExecutorPath)) {
            return {
                valid: false,
                error: 'Project does not contain .claudiomiro/task-executor/ directory',
            };
        }

        return {
            valid: true,
            resolvedPath,
        };
    } catch (error) {
        return {
            valid: false,
            error: 'Invalid project path',
        };
    }
};

/**
 * Get the task executor path for a project
 * @param {string} projectPath - The project path
 * @returns {string} - Path to .claudiomiro/task-executor/
 */
const getTaskExecutorPath = (projectPath) => {
    return path.join(projectPath, '.claudiomiro', 'task-executor');
};

/**
 * Decode a URL-encoded project path
 * @param {string} encodedPath - The URL-encoded path
 * @returns {string} - Decoded path
 */
const decodeProjectPath = (encodedPath) => {
    try {
        return decodeURIComponent(encodedPath);
    } catch {
        return encodedPath;
    }
};

/**
 * Send a success response
 * @param {express.Response} res - Express response object
 * @param {*} data - Data to send
 */
const sendSuccess = (res, data) => {
    res.json({
        success: true,
        data,
    });
};

/**
 * Send an error response
 * @param {express.Response} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message (sanitized - no filesystem paths)
 */
const sendError = (res, statusCode, message) => {
    res.status(statusCode).json({
        success: false,
        error: message,
    });
};

module.exports = {
    validateProjectPath,
    getTaskExecutorPath,
    decodeProjectPath,
    sendSuccess,
    sendError,
};
