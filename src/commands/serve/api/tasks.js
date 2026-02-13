const express = require('express');
const fs = require('fs');
const path = require('path');

/**
 * Creates tasks API router
 * @param {Object} options - Router options
 * @param {string} options.projectPath - Project root path
 * @returns {express.Router} Express router for tasks endpoints
 */
const createTasksRouter = (_options = {}) => {
    const router = express.Router({ mergeParams: true });

    // Helper: Get task executor path for a project
    const getTaskExecutorPath = (projectPath) => {
        return path.join(projectPath, '.claudiomiro', 'task-executor');
    };

    // Helper: Validate taskId format
    const isValidTaskId = (taskId) => {
        return /^TASK\d+(\.\d+)?$|^TASKΩ$/.test(taskId);
    };

    // Helper: Send success response
    const sendSuccess = (res, data) => {
        res.json({ success: true, data });
    };

    // Helper: Send error response
    const sendError = (res, statusCode, error) => {
        res.status(statusCode).json({ success: false, error });
    };

    // Middleware: Validate taskId parameter
    router.param('taskId', (req, res, next, taskId) => {
        if (!isValidTaskId(taskId)) {
            return sendError(res, 400, `Invalid taskId format: ${taskId}`);
        }
        next();
    });

    // GET / - List all tasks
    router.get('/', (req, res) => {
        try {
            const projectPath = req.params.projectPath;
            const taskExecutorPath = getTaskExecutorPath(projectPath);

            if (!fs.existsSync(taskExecutorPath)) {
                return sendSuccess(res, []);
            }

            // Scan for TASKN directories
            const taskDirs = fs.readdirSync(taskExecutorPath)
                .filter(name => {
                    const fullPath = path.join(taskExecutorPath, name);
                    return fs.statSync(fullPath).isDirectory() && /^TASK\d+/.test(name);
                })
                .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

            const tasks = [];

            for (const taskId of taskDirs) {
                const taskPath = path.join(taskExecutorPath, taskId);
                const executionPath = path.join(taskPath, 'execution.json');
                const blueprintPath = path.join(taskPath, 'BLUEPRINT.md');

                let status = 'pending';
                let title = taskId;
                let dependencies = [];

                // Read execution.json for status and title
                if (fs.existsSync(executionPath)) {
                    try {
                        const execution = JSON.parse(fs.readFileSync(executionPath, 'utf-8'));
                        status = execution.status || 'pending';
                        title = execution.title || taskId;
                    } catch (err) {
                        // Invalid JSON - keep defaults
                    }
                }

                // Read BLUEPRINT.md for dependencies
                if (fs.existsSync(blueprintPath)) {
                    try {
                        const blueprint = fs.readFileSync(blueprintPath, 'utf-8');
                        const depsMatch = blueprint.match(/^\s*@dependencies\s*(?:\[(.*?)\]|(.+))\s*$/mi);

                        if (depsMatch) {
                            const raw = (depsMatch[1] ?? depsMatch[2] ?? '').trim();
                            dependencies = raw
                                ? raw.split(',')
                                    .filter(s => (s || '').toLowerCase() !== 'none')
                                    .map(s => s.trim())
                                    .filter(Boolean)
                                : [];
                        }
                    } catch (err) {
                        // Keep empty dependencies
                    }
                }

                tasks.push({
                    id: taskId,
                    title,
                    status,
                    dependencies,
                });
            }

            sendSuccess(res, tasks);
        } catch (err) {
            sendError(res, 500, `Failed to list tasks: ${err.message}`);
        }
    });

    // GET /:taskId - Full task details
    router.get('/:taskId', (req, res) => {
        try {
            const { projectPath, taskId } = req.params;
            const taskPath = path.join(getTaskExecutorPath(projectPath), taskId);

            if (!fs.existsSync(taskPath)) {
                return sendError(res, 404, `Task not found: ${taskId}`);
            }

            const result = {
                id: taskId,
                blueprint: null,
                execution: null,
                review: null,
            };

            // Read BLUEPRINT.md
            const blueprintPath = path.join(taskPath, 'BLUEPRINT.md');
            if (fs.existsSync(blueprintPath)) {
                result.blueprint = fs.readFileSync(blueprintPath, 'utf-8');
            }

            // Read execution.json
            const executionPath = path.join(taskPath, 'execution.json');
            if (fs.existsSync(executionPath)) {
                try {
                    result.execution = JSON.parse(fs.readFileSync(executionPath, 'utf-8'));
                } catch (err) {
                    result.execution = { error: 'Invalid JSON' };
                }
            }

            // Read CODE_REVIEW.md
            const codeReviewPath = path.join(taskPath, 'CODE_REVIEW.md');
            if (fs.existsSync(codeReviewPath)) {
                result.review = fs.readFileSync(codeReviewPath, 'utf-8');
            }

            sendSuccess(res, result);
        } catch (err) {
            sendError(res, 500, `Failed to get task details: ${err.message}`);
        }
    });

    // GET /:taskId/blueprint - Raw BLUEPRINT.md content
    router.get('/:taskId/blueprint', (req, res) => {
        try {
            const { projectPath, taskId } = req.params;
            const blueprintPath = path.join(getTaskExecutorPath(projectPath), taskId, 'BLUEPRINT.md');

            if (!fs.existsSync(blueprintPath)) {
                return sendError(res, 404, `BLUEPRINT.md not found for task: ${taskId}`);
            }

            const content = fs.readFileSync(blueprintPath, 'utf-8');
            sendSuccess(res, { content });
        } catch (err) {
            sendError(res, 500, `Failed to read BLUEPRINT.md: ${err.message}`);
        }
    });

    // GET /:taskId/execution - Parsed execution.json
    router.get('/:taskId/execution', (req, res) => {
        try {
            const { projectPath, taskId } = req.params;
            const executionPath = path.join(getTaskExecutorPath(projectPath), taskId, 'execution.json');

            if (!fs.existsSync(executionPath)) {
                return sendError(res, 404, `execution.json not found for task: ${taskId}`);
            }

            const content = fs.readFileSync(executionPath, 'utf-8');
            try {
                const execution = JSON.parse(content);
                sendSuccess(res, execution);
            } catch (err) {
                sendError(res, 400, `Invalid JSON in execution.json: ${err.message}`);
            }
        } catch (err) {
            sendError(res, 500, `Failed to read execution.json: ${err.message}`);
        }
    });

    // GET /:taskId/review - CODE_REVIEW.md content
    router.get('/:taskId/review', (req, res) => {
        try {
            const { projectPath, taskId } = req.params;
            const taskPath = path.join(getTaskExecutorPath(projectPath), taskId);

            const result = {
                codeReview: null,
                reviewChecklist: null,
            };

            // Read CODE_REVIEW.md
            const codeReviewPath = path.join(taskPath, 'CODE_REVIEW.md');
            if (fs.existsSync(codeReviewPath)) {
                result.codeReview = fs.readFileSync(codeReviewPath, 'utf-8');
            }

            // Read REVIEW_CHECKLIST.md
            const checklistPath = path.join(taskPath, 'REVIEW_CHECKLIST.md');
            if (fs.existsSync(checklistPath)) {
                result.reviewChecklist = fs.readFileSync(checklistPath, 'utf-8');
            }

            sendSuccess(res, result);
        } catch (err) {
            sendError(res, 500, `Failed to read review files: ${err.message}`);
        }
    });

    // PUT /:taskId/blueprint - Update BLUEPRINT.md
    router.put('/:taskId/blueprint', express.json(), (req, res) => {
        try {
            const { projectPath, taskId } = req.params;
            const { content } = req.body;

            if (!content || typeof content !== 'string') {
                return sendError(res, 400, 'Content must be a non-empty string');
            }

            const blueprintPath = path.join(getTaskExecutorPath(projectPath), taskId, 'BLUEPRINT.md');
            const taskPath = path.dirname(blueprintPath);

            // Ensure task directory exists
            if (!fs.existsSync(taskPath)) {
                fs.mkdirSync(taskPath, { recursive: true });
            }

            fs.writeFileSync(blueprintPath, content, 'utf-8');
            sendSuccess(res, { message: 'BLUEPRINT.md updated successfully' });
        } catch (err) {
            sendError(res, 500, `Failed to update BLUEPRINT.md: ${err.message}`);
        }
    });

    // PUT /:taskId/execution - Update execution.json
    router.put('/:taskId/execution', express.json(), (req, res) => {
        try {
            const { projectPath, taskId } = req.params;
            const data = req.body;

            if (!data || typeof data !== 'object') {
                return sendError(res, 400, 'Body must be a valid JSON object');
            }

            // Basic validation - check required fields
            if (!data.status || !data.task || !data.title) {
                return sendError(res, 400, 'Missing required fields: status, task, title');
            }

            const executionPath = path.join(getTaskExecutorPath(projectPath), taskId, 'execution.json');
            const taskPath = path.dirname(executionPath);

            // Ensure task directory exists
            if (!fs.existsSync(taskPath)) {
                fs.mkdirSync(taskPath, { recursive: true });
            }

            fs.writeFileSync(executionPath, JSON.stringify(data, null, 2), 'utf-8');
            sendSuccess(res, { message: 'execution.json updated successfully' });
        } catch (err) {
            sendError(res, 500, `Failed to update execution.json: ${err.message}`);
        }
    });

    // POST /:taskId/retry - Reset task to retry
    router.post('/:taskId/retry', (req, res) => {
        try {
            const { projectPath, taskId } = req.params;
            const executionPath = path.join(getTaskExecutorPath(projectPath), taskId, 'execution.json');

            if (!fs.existsSync(executionPath)) {
                return sendError(res, 404, `execution.json not found for task: ${taskId}`);
            }

            // Read, modify, write back
            const execution = JSON.parse(fs.readFileSync(executionPath, 'utf-8'));

            execution.status = 'pending';
            execution.attempts = (execution.attempts || 0) + 1;
            execution.errorHistory = [];

            fs.writeFileSync(executionPath, JSON.stringify(execution, null, 2), 'utf-8');
            sendSuccess(res, { message: 'Task reset to pending for retry', attempts: execution.attempts });
        } catch (err) {
            sendError(res, 500, `Failed to retry task: ${err.message}`);
        }
    });

    // POST /:taskId/approve-review - Mark code review as approved
    router.post('/:taskId/approve-review', (req, res) => {
        try {
            const { projectPath, taskId } = req.params;
            const codeReviewPath = path.join(getTaskExecutorPath(projectPath), taskId, 'CODE_REVIEW.md');

            if (!fs.existsSync(codeReviewPath)) {
                return sendError(res, 404, `CODE_REVIEW.md not found for task: ${taskId}`);
            }

            // Append approval marker
            const approvalMarker = '\n\n## Status\n\nAPPROVED\n';
            fs.appendFileSync(codeReviewPath, approvalMarker, 'utf-8');

            sendSuccess(res, { message: 'Code review approved successfully' });
        } catch (err) {
            sendError(res, 500, `Failed to approve code review: ${err.message}`);
        }
    });

    return router;
};

module.exports = { createTasksRouter };
