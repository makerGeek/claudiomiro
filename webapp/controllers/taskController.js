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
        files: [],
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

      // Store reference to global process to avoid variable conflicts
      const globalProcess = process;

      // Build command arguments
      const args = [
        path.join(__dirname, '../../index.js'),
        `--prompt=${task.prompt}`,
        '--fresh'  // Always start fresh in webapp to avoid interactive prompts
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
        env: { ...globalProcess.env, FORCE_COLOR: '0' }
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
    // Look for general step indicators (for non-parallel tasks)
    const stepMatches = [
      { pattern: /Cycle \d+.*Step 0/i, progress: 10 },
      { pattern: /Step 0.*completed|Decomposing|INITIAL_PROMPT\.md/i, progress: 15 },
      { pattern: /Cycle \d+.*Step 2|Creating TODO/i, progress: 25 },
      { pattern: /Step 2.*completed|TODO\.md.*created/i, progress: 35 },
      { pattern: /Cycle \d+.*Step 3|Implementing/i, progress: 45 },
      { pattern: /Step 3.*completed|Implementation.*complete/i, progress: 60 },
      { pattern: /Cycle \d+.*Step 4|Code review|Running.*review/i, progress: 70 },
      { pattern: /Step 4.*completed|Code review.*passed|✓.*approved/i, progress: 85 },
      { pattern: /Cycle \d+.*Step 5|Creating commit|Committing/i, progress: 90 },
      { pattern: /Step 5.*completed|Committed.*pushed|✓.*Task completed/i, progress: 95 }
    ];

    for (const { pattern, progress } of stepMatches) {
      if (pattern.test(log)) {
        // Update overall task progress if no subtasks
        if (task.subtasks.length === 0) {
          task.progress = Math.max(task.progress, progress);
        }
        break;
      }
    }

    // Look for subtask patterns in logs (for parallel execution)
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

    // Look for step completion patterns (for subtasks)
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

    // Look for file creation patterns
    const filePatterns = [
      /(?:Created|Generated|Wrote|Writing|Created file|File created)(?:\s+file)?:\s*([^\s]+\.(?:pdf|png|jpg|jpeg|gif|svg|html|json|xml|csv))/i,
      /(?:✓|✅)\s+(?:Created|Generated|Wrote)\s+([^\s]+\.(?:pdf|png|jpg|jpeg|gif|svg|html|json|xml|csv))/i,
      /File created successfully at:\s*([^\s]+)/i,
      /(?:Saved to|Written to):\s*([^\s]+\.(?:pdf|png|jpg|jpeg|gif|svg|html|json|xml|csv))/i
    ];

    for (const pattern of filePatterns) {
      const fileMatch = log.match(pattern);
      if (fileMatch && fileMatch[1]) {
        const filePath = fileMatch[1].trim();
        const fileName = path.basename(filePath);
        const fileExt = path.extname(fileName).toLowerCase();

        // Check if file not already tracked
        if (!task.files.find(f => f.path === filePath)) {
          task.files.push({
            name: fileName,
            path: filePath,
            type: fileExt,
            createdAt: new Date().toISOString()
          });

          // Emit file created event
          this.io.emit('fileCreated', { taskId: task.id, file: task.files[task.files.length - 1] });
        }
        break;
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
   * Serve a file from the filesystem
   */
  async getFile(req, res) {
    try {
      const { taskId, fileName } = req.params;
      const task = this.tasks.get(taskId);

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Find the file in the task's files
      const file = task.files.find(f => f.name === fileName);
      if (!file) {
        return res.status(404).json({ error: 'File not found in task' });
      }

      // Resolve the file path
      const filePath = path.isAbsolute(file.path)
        ? file.path
        : path.join(process.cwd(), file.path);

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch (error) {
        return res.status(404).json({ error: 'File not found on filesystem' });
      }

      // Set appropriate content type
      const contentTypes = {
        '.pdf': 'application/pdf',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.html': 'text/html',
        '.json': 'application/json',
        '.xml': 'application/xml',
        '.csv': 'text/csv'
      };

      const contentType = contentTypes[file.type] || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${file.name}"`);

      // Stream the file
      const fileStream = require('fs').createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error('Error serving file:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Generate a unique task ID
   */
  generateTaskId() {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = TaskController;
