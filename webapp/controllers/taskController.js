const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');

class TaskController {
  constructor(io) {
    this.io = io;
    this.tasks = new Map(); // Store tasks in memory
    this.config = {
      executor: 'claude',
      maxConcurrent: 5,
      push: false,
      sameBranch: false,
      limit: 20
    };
  }

  /**
   * Create a new task
   */
  async createTask(req, res) {
    try {
      const { prompt, options = {} } = req.body;

      if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
        return res.status(400).json({ error: 'Prompt is required and must be a non-empty string' });
      }

      // Generate unique task ID
      const taskId = this.generateTaskId();

      // Merge options with default config
      const taskConfig = { ...this.config, ...options };

      // Create task object
      const task = {
        id: taskId,
        prompt: prompt.trim(),
        config: taskConfig,
        status: 'queued',
        createdAt: new Date().toISOString(),
        startedAt: null,
        completedAt: null,
        logs: [],
        subtasks: [],
        error: null,
        progress: 0
      };

      // Store task
      this.tasks.set(taskId, task);

      // Emit task created event
      this.io.emit('taskCreated', task);

      // Start task execution
      this.executeTask(taskId);

      res.status(201).json({
        success: true,
        taskId,
        message: 'Task created and queued for execution',
        task
      });
    } catch (error) {
      console.error('Error creating task:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get all tasks
   */
  async getTasks(req, res) {
    try {
      const tasks = Array.from(this.tasks.values()).map(task => ({
        id: task.id,
        prompt: task.prompt,
        status: task.status,
        createdAt: task.createdAt,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
        progress: task.progress,
        subtasks: task.subtasks.map(st => ({
          id: st.id,
          name: st.name,
          status: st.status,
          progress: st.progress
        }))
      }));

      res.json({ success: true, tasks });
    } catch (error) {
      console.error('Error getting tasks:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get a specific task
   */
  async getTask(req, res) {
    try {
      const { id } = req.params;
      const task = this.tasks.get(id);

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      res.json({ success: true, task });
    } catch (error) {
      console.error('Error getting task:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Cancel a task
   */
  async cancelTask(req, res) {
    try {
      const { id } = req.params;
      const task = this.tasks.get(id);

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      if (task.status === 'completed' || task.status === 'failed') {
        return res.status(400).json({ error: 'Cannot cancel completed or failed task' });
      }

      // Kill the process if it's running
      if (task.process) {
        task.process.kill();
      }

      task.status = 'cancelled';
      task.completedAt = new Date().toISOString();

      this.io.emit('taskUpdated', task);

      res.json({ success: true, message: 'Task cancelled', task });
    } catch (error) {
      console.error('Error cancelling task:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get current configuration
   */
  async getConfig(req, res) {
    try {
      res.json({ success: true, config: this.config });
    } catch (error) {
      console.error('Error getting config:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Update configuration
   */
  async updateConfig(req, res) {
    try {
      const updates = req.body;

      // Validate and update config
      if (updates.executor && ['claude', 'codex', 'gemini', 'deep-seek', 'glm'].includes(updates.executor)) {
        this.config.executor = updates.executor;
      }

      if (typeof updates.maxConcurrent === 'number' && updates.maxConcurrent > 0) {
        this.config.maxConcurrent = updates.maxConcurrent;
      }

      // Note: mode is not supported in claudiomiro CLI

      if (typeof updates.push === 'boolean') {
        this.config.push = updates.push;
      }

      if (typeof updates.sameBranch === 'boolean') {
        this.config.sameBranch = updates.sameBranch;
      }

      if (typeof updates.limit === 'number' && updates.limit > 0) {
        this.config.limit = updates.limit;
      }

      res.json({ success: true, config: this.config });
    } catch (error) {
      console.error('Error updating config:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Execute a task
   */
  async executeTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return;

    try {
      task.status = 'running';
      task.startedAt = new Date().toISOString();
      this.io.emit('taskUpdated', task);

      // Build command arguments
      const args = [
        path.join(__dirname, '../../index.js'),
        `--prompt=${task.prompt}`
      ];

      // Add configuration flags
      if (task.config.executor !== 'claude') {
        args.push(`--${task.config.executor}`);
      }
      if (task.config.maxConcurrent) {
        args.push(`--maxConcurrent=${task.config.maxConcurrent}`);
      }
      // Note: --mode flag doesn't exist in claudiomiro CLI, removed
      if (task.config.push === false) {
        args.push('--push=false');
      }
      if (task.config.sameBranch) {
        args.push('--same-branch');
      }
      if (task.config.limit) {
        args.push(`--limit=${task.config.limit}`);
      }

      // Spawn claudiomiro process
      const childProcess = spawn('node', args, {
        cwd: path.join(__dirname, '../..'),
        env: { ...process.env, FORCE_COLOR: '0' }
      });

      task.process = childProcess;

      // Handle stdout
      childProcess.stdout.on('data', (data) => {
        const log = data.toString();
        task.logs.push({ type: 'stdout', message: log, timestamp: new Date().toISOString() });

        // Parse log for progress updates
        this.parseLogForProgress(task, log);

        this.io.emit('taskLog', { taskId, log: { type: 'stdout', message: log } });
      });

      // Handle stderr
      childProcess.stderr.on('data', (data) => {
        const log = data.toString();
        task.logs.push({ type: 'stderr', message: log, timestamp: new Date().toISOString() });
        this.io.emit('taskLog', { taskId, log: { type: 'stderr', message: log } });
      });

      // Handle process completion
      childProcess.on('close', (code) => {
        task.completedAt = new Date().toISOString();

        if (code === 0) {
          task.status = 'completed';
          task.progress = 100;
        } else if (task.status !== 'cancelled') {
          task.status = 'failed';
          task.error = `Process exited with code ${code}`;
        }

        delete task.process;
        this.io.emit('taskUpdated', task);
      });

      // Handle process errors
      childProcess.on('error', (error) => {
        task.status = 'failed';
        task.error = error.message;
        task.completedAt = new Date().toISOString();
        delete task.process;
        this.io.emit('taskUpdated', task);
      });

    } catch (error) {
      console.error('Error executing task:', error);
      task.status = 'failed';
      task.error = error.message;
      task.completedAt = new Date().toISOString();
      this.io.emit('taskUpdated', task);
    }
  }

  /**
   * Parse logs to extract progress information
   */
  parseLogForProgress(task, log) {
    // Look for subtask patterns in logs
    const subtaskMatch = log.match(/TASK(\d+):/);
    if (subtaskMatch) {
      const subtaskId = subtaskMatch[1];
      const subtaskName = log.split(':')[1]?.trim() || `Task ${subtaskId}`;

      let subtask = task.subtasks.find(st => st.id === subtaskId);
      if (!subtask) {
        subtask = {
          id: subtaskId,
          name: subtaskName,
          status: 'running',
          progress: 0
        };
        task.subtasks.push(subtask);
      }
    }

    // Look for step completion patterns
    if (log.includes('Step 2 completed') || log.includes('TODO.md created')) {
      const runningSubtask = task.subtasks.find(st => st.status === 'running');
      if (runningSubtask) runningSubtask.progress = 25;
    }

    if (log.includes('Step 3 completed') || log.includes('Implementation complete')) {
      const runningSubtask = task.subtasks.find(st => st.status === 'running');
      if (runningSubtask) runningSubtask.progress = 50;
    }

    if (log.includes('Step 4 completed') || log.includes('Code review passed')) {
      const runningSubtask = task.subtasks.find(st => st.status === 'running');
      if (runningSubtask) runningSubtask.progress = 75;
    }

    if (log.includes('Step 5 completed') || log.includes('Committed and pushed')) {
      const runningSubtask = task.subtasks.find(st => st.status === 'running');
      if (runningSubtask) {
        runningSubtask.progress = 100;
        runningSubtask.status = 'completed';
      }
    }

    // Calculate overall progress
    if (task.subtasks.length > 0) {
      const totalProgress = task.subtasks.reduce((sum, st) => sum + st.progress, 0);
      task.progress = Math.round(totalProgress / task.subtasks.length);
    }

    this.io.emit('taskUpdated', task);
  }

  /**
   * Generate a unique task ID
   */
  generateTaskId() {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = TaskController;
