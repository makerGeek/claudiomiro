/**
 * Projects API Router
 * Provides endpoints for listing projects and retrieving project state
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { validateProjectPath, getTaskExecutorPath, decodeProjectPath, sendSuccess, sendError } = require('./path-utils');

/**
 * Create a router for project endpoints
 * @param {Object} options - Router configuration
 * @param {string[]} options.projectPaths - Array of registered project paths
 * @returns {express.Router} - Configured Express router
 */
const createProjectsRouter = (options = {}) => {
    const { projectPaths = [] } = options;
    const router = express.Router();

    /**
     * GET /api/projects
     * List all registered projects with task counts
     */
    router.get('/', (req, res) => {
        try {
            const projects = [];

            for (const projectPath of projectPaths) {
                const resolvedPath = path.resolve(projectPath);
                const taskExecutorPath = getTaskExecutorPath(resolvedPath);

                // Verify project exists and has .claudiomiro/task-executor/
                if (!fs.existsSync(taskExecutorPath)) {
                    continue;
                }

                // Count tasks
                let taskCount = 0;
                let completedCount = 0;

                try {
                    const entries = fs.readdirSync(taskExecutorPath);
                    const taskDirs = entries.filter(name => {
                        const fullPath = path.join(taskExecutorPath, name);
                        return fs.statSync(fullPath).isDirectory() && /^TASK\d+/.test(name);
                    });

                    taskCount = taskDirs.length;

                    // Count completed tasks
                    for (const taskDir of taskDirs) {
                        const executionPath = path.join(taskExecutorPath, taskDir, 'execution.json');
                        if (fs.existsSync(executionPath)) {
                            const execution = JSON.parse(fs.readFileSync(executionPath, 'utf-8'));
                            if (execution.status === 'completed' || execution.completion?.status === 'completed') {
                                completedCount++;
                            }
                        }
                    }
                } catch (error) {
                    // Ignore errors reading individual projects
                }

                projects.push({
                    name: path.basename(resolvedPath),
                    path: resolvedPath,
                    taskCount,
                    completedCount,
                });
            }

            sendSuccess(res, projects);
        } catch (error) {
            console.error('Error listing projects:', error);
            sendError(res, 500, 'Failed to list projects');
        }
    });

    /**
     * GET /api/projects/:projectPath/state
     * Get aggregated state for a specific project
     */
    router.get('/:projectPath/state', (req, res) => {
        try {
            const encodedPath = req.params.projectPath;
            const decodedPath = decodeProjectPath(encodedPath);

            // Validate project path
            const validation = validateProjectPath(decodedPath, projectPaths);
            if (!validation.valid) {
                return sendError(res, 400, validation.error);
            }

            const taskExecutorPath = getTaskExecutorPath(validation.resolvedPath);

            // Scan for tasks
            const tasks = [];
            let overallStatus = 'idle';
            let completedCount = 0;
            let inProgressCount = 0;
            let blockedCount = 0;

            const entries = fs.readdirSync(taskExecutorPath);
            const taskDirs = entries
                .filter(name => {
                    const fullPath = path.join(taskExecutorPath, name);
                    return fs.statSync(fullPath).isDirectory() && /^TASK\d+/.test(name);
                })
                .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

            for (const taskDir of taskDirs) {
                const taskPath = path.join(taskExecutorPath, taskDir);
                const executionPath = path.join(taskPath, 'execution.json');
                const blueprintPath = path.join(taskPath, 'BLUEPRINT.md');

                let taskData = {
                    id: taskDir,
                    status: 'unknown',
                    title: taskDir,
                };

                // Read execution.json
                if (fs.existsSync(executionPath)) {
                    try {
                        const execution = JSON.parse(fs.readFileSync(executionPath, 'utf-8'));
                        taskData.status = execution.status || 'unknown';
                        taskData.title = execution.title || taskDir;
                        taskData.currentPhase = execution.currentPhase;
                        taskData.completion = execution.completion;

                        // Count status types
                        if (execution.status === 'completed' || execution.completion?.status === 'completed') {
                            completedCount++;
                        } else if (execution.status === 'in_progress') {
                            inProgressCount++;
                        } else if (execution.status === 'blocked') {
                            blockedCount++;
                        }
                    } catch {
                        // Ignore parse errors
                    }
                }

                // Read BLUEPRINT.md for dependencies
                if (fs.existsSync(blueprintPath)) {
                    try {
                        const blueprint = fs.readFileSync(blueprintPath, 'utf-8');
                        const depsMatch = blueprint.match(/^\s*@dependencies\s*(?:\[(.*?)\]|(.+))\s*$/mi);
                        if (depsMatch) {
                            const raw = (depsMatch[1] ?? depsMatch[2] ?? '').trim();
                            const deps = raw
                                ? raw.split(',').filter(s => (s || '').toLowerCase() !== 'none').map(s => s.trim()).filter(Boolean)
                                : [];
                            taskData.dependencies = Array.from(new Set(deps));
                        }
                    } catch {
                        // Ignore parse errors
                    }
                }

                tasks.push(taskData);
            }

            // Determine overall status
            if (inProgressCount > 0) {
                overallStatus = 'in_progress';
            } else if (blockedCount > 0) {
                overallStatus = 'blocked';
            } else if (completedCount === tasks.length && tasks.length > 0) {
                overallStatus = 'completed';
            } else if (tasks.length > 0) {
                overallStatus = 'pending';
            }

            const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

            sendSuccess(res, {
                project: {
                    name: path.basename(validation.resolvedPath),
                    path: validation.resolvedPath,
                },
                tasks,
                overallStatus,
                progress,
                summary: {
                    total: tasks.length,
                    completed: completedCount,
                    inProgress: inProgressCount,
                    blocked: blockedCount,
                },
            });
        } catch (error) {
            console.error('Error fetching project state:', error);
            sendError(res, 500, 'Failed to fetch project state');
        }
    });

    return router;
};

module.exports = createProjectsRouter;
