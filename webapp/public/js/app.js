// WebSocket connection
let socket;
let isConnected = false;

// State
const state = {
    tasks: new Map(),
    config: null
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initWebSocket();
    setupEventListeners();
    loadConfig();
});

// WebSocket initialization
function initWebSocket() {
    socket = io();

    socket.on('connect', () => {
        console.log('Connected to server');
        isConnected = true;
        updateConnectionStatus(true);
        socket.emit('getTasks');
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        isConnected = false;
        updateConnectionStatus(false);
    });

    socket.on('connected', (data) => {
        console.log('Server message:', data.message);
        state.config = data.config;
    });

    socket.on('taskCreated', (task) => {
        console.log('Task created:', task);
        state.tasks.set(task.id, task);
        renderTasks();
    });

    socket.on('taskUpdated', (task) => {
        console.log('Task updated:', task);
        state.tasks.set(task.id, task);
        renderTasks();
    });

    socket.on('taskLog', ({ taskId, log }) => {
        const task = state.tasks.get(taskId);
        if (task) {
            if (!task.logs) task.logs = [];
            task.logs.push(log);

            // Update task detail view if open
            const taskModal = document.getElementById('taskModal');
            if (taskModal.classList.contains('active')) {
                const currentTaskId = taskModal.dataset.taskId;
                if (currentTaskId === taskId) {
                    renderTaskDetails(task);
                }
            }
        }
    });

    socket.on('fileCreated', ({ taskId, file }) => {
        const task = state.tasks.get(taskId);
        if (task) {
            if (!task.files) task.files = [];
            task.files.push(file);

            // Update task detail view if open
            const taskModal = document.getElementById('taskModal');
            if (taskModal.classList.contains('active')) {
                const currentTaskId = taskModal.dataset.taskId;
                if (currentTaskId === taskId) {
                    renderTaskDetails(task);
                }
            }

            // Show notification for PDF files
            if (file.type === '.pdf') {
                showNotification(`PDF generated: ${file.name}`, 'success');
            }
        }
    });

    socket.on('tasksList', (tasks) => {
        state.tasks.clear();
        tasks.forEach(task => state.tasks.set(task.id, task));
        renderTasks();
    });

    socket.on('error', (error) => {
        console.error('Socket error:', error);
        showNotification('Error: ' + error.message, 'error');
    });
}

// Setup event listeners
function setupEventListeners() {
    // Task form submission
    document.getElementById('taskForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await createTask();
    });

    // Settings button
    document.getElementById('settingsBtn').addEventListener('click', () => {
        openSettingsModal();
    });

    // Settings modal
    document.getElementById('closeSettings').addEventListener('click', closeSettingsModal);
    document.getElementById('cancelSettings').addEventListener('click', closeSettingsModal);
    document.getElementById('saveSettings').addEventListener('click', saveSettings);

    // Task modal
    document.getElementById('closeTaskModal').addEventListener('click', closeTaskModal);

    // Close modals on outside click
    document.getElementById('settingsModal').addEventListener('click', (e) => {
        if (e.target.id === 'settingsModal') {
            closeSettingsModal();
        }
    });

    document.getElementById('taskModal').addEventListener('click', (e) => {
        if (e.target.id === 'taskModal') {
            closeTaskModal();
        }
    });
}

// Create task
async function createTask() {
    const promptInput = document.getElementById('promptInput');
    const prompt = promptInput.value.trim();

    if (!prompt) {
        showNotification('Please enter a task description', 'error');
        return;
    }

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="btn-icon">⏳</span> Creating...';

    try {
        const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompt })
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Task created successfully!', 'success');
            promptInput.value = '';
        } else {
            throw new Error(data.error || 'Failed to create task');
        }
    } catch (error) {
        console.error('Error creating task:', error);
        showNotification('Failed to create task: ' + error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="btn-icon">🚀</span> Start Task';
    }
}

// Load configuration
async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        const data = await response.json();

        if (data.success) {
            state.config = data.config;
            updateConfigForm(data.config);
        }
    } catch (error) {
        console.error('Error loading config:', error);
    }
}

// Update config form
function updateConfigForm(config) {
    document.getElementById('executor').value = config.executor || 'claude';
    document.getElementById('maxConcurrent').value = config.maxConcurrent || 5;
    document.getElementById('limit').value = config.limit || 20;
    document.getElementById('push').checked = config.push || false;
    document.getElementById('sameBranch').checked = config.sameBranch || false;
}

// Save settings
async function saveSettings() {
    const config = {
        executor: document.getElementById('executor').value,
        maxConcurrent: parseInt(document.getElementById('maxConcurrent').value),
        limit: parseInt(document.getElementById('limit').value),
        push: document.getElementById('push').checked,
        sameBranch: document.getElementById('sameBranch').checked
    };

    try {
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });

        const data = await response.json();

        if (data.success) {
            state.config = data.config;
            showNotification('Settings saved successfully!', 'success');
            closeSettingsModal();
        } else {
            throw new Error(data.error || 'Failed to save settings');
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        showNotification('Failed to save settings: ' + error.message, 'error');
    }
}

// Render tasks
function renderTasks() {
    const tasksList = document.getElementById('tasksList');
    const tasks = Array.from(state.tasks.values()).sort((a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
    );

    if (tasks.length === 0) {
        tasksList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📋</div>
                <p>No tasks yet. Create your first task above!</p>
            </div>
        `;
    } else {
        tasksList.innerHTML = tasks.map(task => createTaskCard(task)).join('');

        // Add click listeners
        document.querySelectorAll('.task-card').forEach(card => {
            card.addEventListener('click', () => {
                openTaskModal(card.dataset.taskId);
            });
        });
    }

    updateTaskStats(tasks);
}

// Create task card HTML
function createTaskCard(task) {
    const statusClass = `status-${task.status}`;
    const statusEmoji = getStatusEmoji(task.status);
    const formattedDate = formatDate(task.createdAt);

    return `
        <div class="task-card" data-task-id="${task.id}">
            <div class="task-card-header">
                <div class="task-info">
                    <div class="task-id">${task.id}</div>
                    <div class="task-prompt">${escapeHtml(task.prompt)}</div>
                    <div class="task-meta">
                        <span>Created: ${formattedDate}</span>
                        ${task.subtasks.length > 0 ? `<span>Subtasks: ${task.subtasks.length}</span>` : ''}
                    </div>
                </div>
                <div class="task-status ${statusClass}">
                    <span>${statusEmoji}</span>
                    <span>${capitalizeFirst(task.status)}</span>
                </div>
            </div>
            ${task.status === 'running' ? `
                <div class="task-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${task.progress}%"></div>
                    </div>
                    <div class="progress-text">${task.progress}% complete</div>
                </div>
            ` : ''}
            ${task.subtasks.length > 0 ? `
                <div class="task-subtasks">
                    ${task.subtasks.map(st => `
                        <div class="subtask">
                            <span class="subtask-name">${escapeHtml(st.name)}</span>
                            <span class="subtask-status">${st.progress}%</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `;
}

// Update task stats
function updateTaskStats(tasks) {
    const running = tasks.filter(t => t.status === 'running').length;
    const queued = tasks.filter(t => t.status === 'queued').length;
    const completed = tasks.filter(t => t.status === 'completed').length;

    document.getElementById('runningCount').textContent = running;
    document.getElementById('queuedCount').textContent = queued;
    document.getElementById('completedCount').textContent = completed;
}

// Open task modal
function openTaskModal(taskId) {
    const task = state.tasks.get(taskId);
    if (!task) return;

    const modal = document.getElementById('taskModal');
    modal.dataset.taskId = taskId;
    modal.classList.add('active');

    document.getElementById('taskModalTitle').textContent = `Task: ${task.id}`;
    renderTaskDetails(task);
}

// Render task details
function renderTaskDetails(task) {
    const details = document.getElementById('taskDetails');
    const statusClass = `status-${task.status}`;
    const statusEmoji = getStatusEmoji(task.status);

    details.innerHTML = `
        <div class="task-detail-section">
            <h3>Status</h3>
            <div class="task-status ${statusClass}">
                <span>${statusEmoji}</span>
                <span>${capitalizeFirst(task.status)}</span>
            </div>
        </div>

        <div class="task-detail-section">
            <h3>Prompt</h3>
            <p>${escapeHtml(task.prompt)}</p>
        </div>

        <div class="task-detail-section">
            <h3>Details</h3>
            <p>Created: ${formatDate(task.createdAt)}</p>
            ${task.startedAt ? `<p>Started: ${formatDate(task.startedAt)}</p>` : ''}
            ${task.completedAt ? `<p>Completed: ${formatDate(task.completedAt)}</p>` : ''}
            ${task.error ? `<p style="color: var(--error-color)">Error: ${escapeHtml(task.error)}</p>` : ''}
        </div>

        ${task.subtasks.length > 0 ? `
            <div class="task-detail-section">
                <h3>Subtasks (${task.subtasks.length})</h3>
                ${task.subtasks.map(st => `
                    <div class="subtask">
                        <span class="subtask-name">${escapeHtml(st.name)}</span>
                        <span class="subtask-status">${capitalizeFirst(st.status)} (${st.progress}%)</span>
                    </div>
                `).join('')}
            </div>
        ` : ''}

        ${task.files && task.files.length > 0 ? `
            <div class="task-detail-section">
                <h3>Generated Files (${task.files.length})</h3>
                <div class="files-list">
                    ${task.files.map(file => `
                        <div class="file-item">
                            <div class="file-info">
                                <span class="file-icon">${getFileIcon(file.type)}</span>
                                <span class="file-name">${escapeHtml(file.name)}</span>
                                <a href="/api/tasks/${task.id}/files/${encodeURIComponent(file.name)}"
                                   target="_blank"
                                   class="file-download"
                                   download="${file.name}">
                                    📥 Download
                                </a>
                            </div>
                            ${file.type === '.pdf' || file.type.match(/\.(png|jpg|jpeg|gif|svg)/) ? `
                                <div class="file-preview">
                                    <iframe
                                        src="/api/tasks/${task.id}/files/${encodeURIComponent(file.name)}"
                                        class="preview-iframe ${file.type === '.pdf' ? 'pdf-preview' : 'image-preview'}"
                                        title="Preview of ${escapeHtml(file.name)}">
                                    </iframe>
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}

        ${task.logs && task.logs.length > 0 ? `
            <div class="task-detail-section">
                <h3>Logs (${task.logs.length})</h3>
                <div class="task-logs">
                    ${task.logs.slice(-100).map(log => `
                        <div class="log-entry log-${log.type}">
                            ${escapeHtml(log.message)}
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}
    `;

    // Auto-scroll logs to bottom
    const logsContainer = details.querySelector('.task-logs');
    if (logsContainer) {
        logsContainer.scrollTop = logsContainer.scrollHeight;
    }
}

// Close task modal
function closeTaskModal() {
    const modal = document.getElementById('taskModal');
    modal.classList.remove('active');
    delete modal.dataset.taskId;
}

// Open settings modal
function openSettingsModal() {
    document.getElementById('settingsModal').classList.add('active');
}

// Close settings modal
function closeSettingsModal() {
    document.getElementById('settingsModal').classList.remove('active');
}

// Update connection status
function updateConnectionStatus(connected) {
    let statusEl = document.querySelector('.connection-status');

    if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.className = 'connection-status';
        document.body.appendChild(statusEl);
    }

    const indicator = connected ?
        '<div class="connection-indicator"></div>' :
        '<div class="connection-indicator disconnected"></div>';

    const text = connected ? 'Connected' : 'Disconnected';

    statusEl.innerHTML = `${indicator}<span>${text}</span>`;
}

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 2rem;
        right: 2rem;
        padding: 1rem 1.5rem;
        background: var(--surface);
        border: 2px solid var(--border-color);
        border-radius: 8px;
        box-shadow: var(--shadow-lg);
        z-index: 2000;
        animation: fadeIn 0.3s ease-out;
    `;

    const emoji = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    notification.innerHTML = `<span style="margin-right: 0.5rem;">${emoji}</span>${escapeHtml(message)}`;

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Utility functions
function getStatusEmoji(status) {
    const emojis = {
        queued: '⏳',
        running: '🔄',
        completed: '✅',
        failed: '❌',
        cancelled: '🚫'
    };
    return emojis[status] || '❓';
}

function getFileIcon(fileType) {
    const icons = {
        '.pdf': '📄',
        '.png': '🖼️',
        '.jpg': '🖼️',
        '.jpeg': '🖼️',
        '.gif': '🖼️',
        '.svg': '🖼️',
        '.html': '🌐',
        '.json': '📊',
        '.xml': '📄',
        '.csv': '📊'
    };
    return icons[fileType] || '📎';
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;

    // Less than 1 minute
    if (diff < 60000) {
        return 'Just now';
    }

    // Less than 1 hour
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    }

    // Less than 1 day
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }

    // More than 1 day
    return date.toLocaleString();
}
