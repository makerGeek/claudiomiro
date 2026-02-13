/**
 * Claudiomiro Web UI - Vue Application Entry Point
 *
 * Initializes Vue 3 app, registers components, and mounts to #app.
 */

(function (window) {
    'use strict';

    // Wait for Vue to be available
    if (typeof window.Vue === 'undefined') {
        console.error('Vue is not loaded. Make sure vue.global.prod.js is loaded before app.js');
        return;
    }

    const { createApp, computed } = window.Vue;

    /**
     * Root Vue component
     */
    const app = createApp({
        setup() {
            // Access global state and router
            const store = window.Store;
            const router = window.Router;
            const api = window.Api;
            const wsClient = window.WsClient;

            // Computed current view component based on route
            const currentView = computed(() => {
                if (!router || !router.currentRoute) {
                    return 'dashboard-view';
                }
                const routeName = router.currentRoute.value?.name || 'dashboard';
                return `${routeName}-view`;
            });

            // Load initial data on mount
            const loadInitialData = async () => {
                if (!api) return;

                try {
                    store.setLoading('projects', true);
                    const projects = await api.getProjects();
                    store.setProjects(projects);
                } catch (error) {
                    console.error('[App] Failed to load projects:', error);
                    store.addToast({
                        message: 'Failed to load projects',
                        type: 'error',
                        duration: 5000,
                    });
                } finally {
                    store.setLoading('projects', false);
                }
            };

            // Initialize on mount
            loadInitialData();

            // Template string for root component
            return {
                store,
                router,
                api,
                wsClient,
                currentView,
            };
        },

        template: `
            <div id="claudiomiro-app">
                <!-- Toast Notification Container -->
                <div class="toast-container" v-if="store && store.state.toasts.length > 0">
                    <div
                        v-for="toast in store.state.toasts"
                        :key="toast.id"
                        :class="['toast', 'toast-' + toast.type]"
                    >
                        <div class="toast-message">{{ toast.message }}</div>
                        <button
                            class="toast-close"
                            @click="store.removeToast(toast.id)"
                            aria-label="Close"
                        >&times;</button>
                    </div>
                </div>

                <!-- Header -->
                <header class="header">
                    <h1>
                        <a :href="router.dashboardUrl()" style="color: inherit; text-decoration: none;">
                            Claudiomiro
                        </a>
                    </h1>
                    <div class="header-actions">
                        <!-- Connection Status (placeholder for TASK7) -->
                        <div
                            v-if="wsClient"
                            :class="['connection-status', wsClient.isConnected() ? 'connected' : 'disconnected']"
                        >
                            <span class="connection-indicator"></span>
                            <span>{{ wsClient.isConnected() ? 'Connected' : 'Disconnected' }}</span>
                        </div>
                    </div>
                </header>

                <!-- Main Content Area -->
                <main class="main">
                    <!-- Loading State -->
                    <div v-if="store && store.state.loading.projects" class="loading">
                        <div class="spinner"></div>
                        <p>Loading projects...</p>
                    </div>

                    <!-- Current View (placeholder for TASK7) -->
                    <div v-else>
                        <!-- Dashboard: Project List -->
                        <div v-if="router.currentRoute.value.name === 'dashboard'">
                            <h2>Projects</h2>
                            <div v-if="store.state.projects.length === 0" class="text-muted">
                                No projects found. Run <code>claudiomiro</code> in a project directory first.
                            </div>
                            <div v-else>
                                <div v-for="project in store.state.projects" :key="project.path" class="card">
                                    <h3 class="card-title">
                                        <a :href="router.projectUrl(project.path)">{{ project.name || project.path }}</a>
                                    </h3>
                                    <p class="card-subtitle">{{ project.path }}</p>
                                    <p class="card-body" v-if="project.taskCount !== undefined">
                                        Tasks: {{ project.taskCount }}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <!-- Project: Task List -->
                        <div v-else-if="router.currentRoute.value.name === 'project'">
                            <h2>Tasks</h2>
                            <p class="text-muted">Project: {{ router.currentRoute.value.params.projectPath }}</p>
                            <div v-if="store.state.tasks.length === 0" class="text-muted">
                                No tasks found for this project.
                            </div>
                            <div v-else>
                                <div v-for="task in store.state.tasks" :key="task.id" class="card">
                                    <h3 class="card-title">
                                        <a :href="router.taskUrl(router.currentRoute.value.params.projectPath, task.id)">
                                            {{ task.id }}
                                        </a>
                                    </h3>
                                    <p class="card-subtitle">{{ task.title || 'No title' }}</p>
                                    <span :class="['status-badge', 'status-' + task.status]">{{ task.status }}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Task Detail -->
                        <div v-else-if="router.currentRoute.value.name === 'task'">
                            <h2>Task Detail</h2>
                            <p class="text-muted">Task: {{ router.currentRoute.value.params.taskId }}</p>
                            <div class="card">
                                <p>Full task detail view will be implemented in TASK7.</p>
                            </div>
                        </div>

                        <!-- Unknown Route -->
                        <div v-else>
                            <h2>Page Not Found</h2>
                            <p><a :href="router.dashboardUrl()">Go to Dashboard</a></p>
                        </div>
                    </div>
                </main>
            </div>
        `,
    });

    // Mount app to #app element
    app.mount('#app');

    console.log('[App] Vue app mounted');

})(window);
