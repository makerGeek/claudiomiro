/**
 * Log Access API Router
 * Provides GET endpoint for reading recent log.txt content
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

/**
 * Create a router for log endpoints
 * @param {Object} options - Router configuration
 * @returns {express.Router} - Configured Express router
 */
const createLogsRouter = (_options = {}) => {
    const router = express.Router({ mergeParams: true });

    // Helper: Decode project path safely
    const decodeProjectPath = (encodedPath) => {
        if (!encodedPath) return encodedPath;
        try {
            return decodeURIComponent(encodedPath);
        } catch {
            return encodedPath;
        }
    };

    /**
     * Get last N lines of a file
     * @param {string} filePath - Full path to file
     * @param {number} lines - Number of lines to return
     * @returns {string} - Last N lines joined with newlines
     */
    const getTailLines = (filePath, lines = 100) => {
        const content = fs.readFileSync(filePath, 'utf8');
        const contentLines = content.split('\n');

        // Get last N lines (or all if less than N)
        const startIndex = Math.max(0, contentLines.length - lines);
        return contentLines.slice(startIndex).join('\n');
    };

    /**
     * GET /api/projects/:projectPath/logs?lines=100
     * Read log.txt and return last N lines (default 100)
     */
    router.get('/', (req, res) => {
        try {
            const projectPath = decodeProjectPath(req.params.projectPath);
            if (!projectPath) {
                return res.status(400).json({
                    success: false,
                    error: 'Project path is required',
                });
            }

            // Parse lines parameter (default 100)
            let lines = 100;
            if (req.query.lines) {
                const parsed = parseInt(req.query.lines, 10);
                if (!isNaN(parsed) && parsed > 0) {
                    lines = parsed;
                }
            }

            // Construct path to log.txt: <project>/.claudiomiro/log.txt
            const logPath = path.join(
                projectPath,
                '.claudiomiro',
                'log.txt',
            );

            // Check if file exists
            if (!fs.existsSync(logPath)) {
                // Return empty logs rather than 404 - project may not have logs yet
                return res.json({
                    success: true,
                    data: {
                        content: '',
                        lines: 0,
                    },
                });
            }

            // Read last N lines from file
            const content = getTailLines(logPath, lines);
            const actualLines = content ? content.split('\n').filter(line => line).length : 0;

            res.json({
                success: true,
                data: {
                    content,
                    lines: actualLines,
                },
            });
        } catch (error) {
            console.error('Error reading log.txt:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to read logs',
            });
        }
    });

    return router;
};

module.exports = { createLogsRouter };
