/**
 * Claudiomiro Web UI - Reactive State Store
 *
 * Uses Vue 3 reactive API for global state management.
 * No build tools - plain JavaScript using Vue global object.
 */

(function (window) {
    'use strict';

    // Wait for Vue to be available
    if (typeof window.Vue === 'undefined') {
        console.error('Vue is not loaded. Make sure vue.global.prod.js is loaded before store.js');
        return;
    }

    const { reactive } = window.Vue;

    /**
     * Create reactive store with Vue.reactive()
     */
    const state = reactive({
        // Projects list
        projects: [],
        currentProject: null,

        // Tasks for current project
        tasks: [],
        currentTask: null,

        // WebSocket connection status
        connectionStatus: 'disconnected', // 'disconnected' | 'connecting' | 'connected'

        // Toast notifications
        toasts: [],

        // Loading states
        loading: {
            projects: false,
            tasks: false,
            taskDetail: false,
        },
    });

    /**
     * Set projects list
     * @param {Array} projects - Array of project objects
     */
    function setProjects(projects) {
        state.projects = projects || [];
    }

    /**
     * Set current project
     * @param {Object} project - Project object
     */
    function setCurrentProject(project) {
        state.currentProject = project;
    }

    /**
     * Set tasks list for current project
     * @param {Array} tasks - Array of task objects
     */
    function setTasks(tasks) {
        state.tasks = tasks || [];
    }

    /**
     * Set current task detail
     * @param {Object} task - Task detail object
     */
    function setCurrentTask(task) {
        state.currentTask = task;
    }

    /**
     * Update a task in the tasks array
     * @param {string} taskId - Task ID
     * @param {Object} updates - Partial task object with updates
     */
    function updateTask(taskId, updates) {
        const index = state.tasks.findIndex(t => t.id === taskId);
        if (index !== -1) {
            state.tasks[index] = { ...state.tasks[index], ...updates };
        }

        // Also update currentTask if it's the same task
        if (state.currentTask && state.currentTask.id === taskId) {
            state.currentTask = { ...state.currentTask, ...updates };
        }
    }

    /**
     * Set WebSocket connection status
     * @param {string} status - Connection status ('disconnected' | 'connecting' | 'connected')
     */
    function setConnectionStatus(status) {
        state.connectionStatus = status;
    }

    /**
     * Add a toast notification
     * @param {Object} toast - Toast object { message, type, duration }
     */
    function addToast(toast) {
        const id = Date.now() + Math.random();
        const toastWithId = {
            id,
            message: toast.message || 'Notification',
            type: toast.type || 'info', // 'success' | 'error' | 'warning' | 'info'
            duration: toast.duration || 5000,
        };

        state.toasts.push(toastWithId);

        // Auto-remove after duration
        if (toastWithId.duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, toastWithId.duration);
        }

        return id;
    }

    /**
     * Remove a toast notification
     * @param {number|string} id - Toast ID
     */
    function removeToast(id) {
        const index = state.toasts.findIndex(t => t.id === id);
        if (index !== -1) {
            state.toasts.splice(index, 1);
        }
    }

    /**
     * Set loading state for a specific key
     * @param {string} key - Loading key ('projects' | 'tasks' | 'taskDetail')
     * @param {boolean} value - Loading state
     */
    function setLoading(key, value) {
        if (key in state.loading) {
            state.loading[key] = value;
        }
    }

    /**
     * Clear all toasts
     */
    function clearToasts() {
        state.toasts = [];
    }

    /**
     * Reset store to initial state
     */
    function reset() {
        state.projects = [];
        state.currentProject = null;
        state.tasks = [];
        state.currentTask = null;
        state.connectionStatus = 'disconnected';
        state.toasts = [];
        state.loading = {
            projects: false,
            tasks: false,
            taskDetail: false,
        };
    }

    // Export store as global object
    window.Store = {
        state,
        setProjects,
        setCurrentProject,
        setTasks,
        setCurrentTask,
        updateTask,
        setConnectionStatus,
        addToast,
        removeToast,
        setLoading,
        clearToasts,
        reset,
    };

})(window);
