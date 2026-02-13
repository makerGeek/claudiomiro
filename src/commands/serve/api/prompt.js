/**
 * AI_PROMPT.md API Router
 * Provides GET/PUT endpoints for reading and updating AI_PROMPT.md content
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

/**
 * Create a router for AI_PROMPT.md endpoints
 * @param {Object} options - Router configuration
 * @param {Object} options.state - State object with claudiomiroFolder getter
 * @returns {express.Router} - Configured Express router
 */
const createPromptRouter = (options = {}) => {
    const router = express.Router({ mergeParams: true });
    const { state: _state } = options;

    /**
     * GET /api/projects/:projectPath/prompt
     * Read AI_PROMPT.md content
     */
    router.get('/', (req, res) => {
        try {
            const projectPath = req.params.projectPath;
            if (!projectPath) {
                return res.status(400).json({
                    success: false,
                    error: 'Project path is required',
                });
            }

            // Construct path to AI_PROMPT.md: <project>/.claudiomiro/task-executor/AI_PROMPT.md
            const aiPromptPath = path.join(
                decodeURIComponent(projectPath),
                '.claudiomiro',
                'task-executor',
                'AI_PROMPT.md',
            );

            // Check if file exists
            if (!fs.existsSync(aiPromptPath)) {
                return res.status(404).json({
                    success: false,
                    error: 'AI_PROMPT.md not found',
                });
            }

            // Read file content
            const content = fs.readFileSync(aiPromptPath, 'utf8');

            res.json({
                success: true,
                data: {
                    content,
                },
            });
        } catch (error) {
            console.error('Error reading AI_PROMPT.md:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to read AI_PROMPT.md',
            });
        }
    });

    /**
     * PUT /api/projects/:projectPath/prompt
     * Update AI_PROMPT.md content
     * Body: { content: "..." }
     */
    router.put('/', (req, res) => {
        try {
            const projectPath = req.params.projectPath;
            if (!projectPath) {
                return res.status(400).json({
                    success: false,
                    error: 'Project path is required',
                });
            }

            const { content } = req.body;

            // Validate content is non-empty string
            if (typeof content !== 'string' || content.trim() === '') {
                return res.status(400).json({
                    success: false,
                    error: 'Content must be a non-empty string',
                });
            }

            // Construct path to AI_PROMPT.md
            const aiPromptPath = path.join(
                decodeURIComponent(projectPath),
                '.claudiomiro',
                'task-executor',
                'AI_PROMPT.md',
            );

            // Ensure directory exists
            const dir = path.dirname(aiPromptPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Write file content
            fs.writeFileSync(aiPromptPath, content, 'utf8');

            res.json({
                success: true,
                data: {
                    message: 'AI_PROMPT.md updated successfully',
                },
            });
        } catch (error) {
            console.error('Error writing AI_PROMPT.md:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to write AI_PROMPT.md',
            });
        }
    });

    return router;
};

module.exports = { createPromptRouter };
