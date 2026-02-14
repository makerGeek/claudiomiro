/**
 * Claudiomiro Web UI - Client-Side Router
 *
 * Hash-based routing for SPA navigation.
 * Routes:
 * - #/ → dashboard (project list)
 * - #/project/:path → project (task list)
 * - #/project/:path/task/:id → task detail
 */

(function (window) {
    'use strict';

    // Wait for Vue to be available
    if (typeof window.Vue === 'undefined') {
        console.error('Vue is not loaded. Make sure vue.global.prod.js is loaded before router.js');
        return;
    }

    const { ref } = window.Vue;

    /**
     * Current route state (Vue ref for reactivity)
     */
    const currentRoute = ref({
        name: 'dashboard',
        params: {},
    });

    /**
     * Parse hash into route object
     * @param {string} hash - URL hash (e.g., "#/project/foo/task/TASK0")
     * @returns {Object} Route object { name, params }
     */
    function parseHash(hash) {
        // Remove leading # and split by /
        const path = hash.replace(/^#\/?/, '');

        if (!path) {
            // #/ or empty → dashboard
            return { name: 'dashboard', params: {} };
        }

        const segments = path.split('/');

        // #/project/:path/task/:id (more specific — check FIRST)
        if (segments[0] === 'project' && segments.length >= 4 && segments[segments.length - 2] === 'task') {
            // Find "task" keyword index
            const taskIndex = segments.lastIndexOf('task');
            const projectPath = segments.slice(1, taskIndex).join('/');
            const taskId = segments[taskIndex + 1];
            return { name: 'task', params: { projectPath, taskId } };
        }

        // #/project/:path (less specific — check SECOND)
        if (segments[0] === 'project' && segments.length >= 2) {
            // Reconstruct project path (may contain slashes)
            const projectPath = segments.slice(1).join('/');
            return { name: 'project', params: { projectPath } };
        }

        // Unknown route → default to dashboard
        console.warn('[Router] Unknown route:', hash);
        return { name: 'dashboard', params: {} };
    }

    /**
     * Update current route from window.location.hash
     */
    function updateRoute() {
        const hash = window.location.hash || '#/';
        const route = parseHash(hash);
        currentRoute.value = route;
        console.log('[Router] Route changed:', route);
    }

    /**
     * Navigate to a new route
     * @param {string} path - Route path (e.g., "/project/foo/task/TASK0")
     */
    function navigate(path) {
        // Ensure path starts with #/
        const hash = path.startsWith('#') ? path : `#${path}`;
        window.location.hash = hash;
    }

    /**
     * Generate hash URL for dashboard
     * @returns {string} Hash URL
     */
    function dashboardUrl() {
        return '#/';
    }

    /**
     * Generate hash URL for project
     * @param {string} projectPath - Project path
     * @returns {string} Hash URL
     */
    function projectUrl(projectPath) {
        return `#/project/${projectPath}`;
    }

    /**
     * Generate hash URL for task
     * @param {string} projectPath - Project path
     * @param {string} taskId - Task ID
     * @returns {string} Hash URL
     */
    function taskUrl(projectPath, taskId) {
        return `#/project/${projectPath}/task/${taskId}`;
    }

    // Listen for hash changes
    window.addEventListener('hashchange', updateRoute);

    // Parse initial route on load
    updateRoute();

    // Export router as global object
    window.Router = {
        currentRoute,
        navigate,
        dashboardUrl,
        projectUrl,
        taskUrl,
    };

})(window);
