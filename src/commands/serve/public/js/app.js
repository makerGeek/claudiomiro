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
                <toast-container></toast-container>

                <!-- Header -->
                <header class="header">
                    <h1>
                        <a :href="router.dashboardUrl()" style="color: inherit; text-decoration: none;">
                            Claudiomiro
                        </a>
                    </h1>
                    <div class="header-actions">
                        <connection-status-component></connection-status-component>
                    </div>
                </header>

                <!-- Main Content Area -->
                <main class="main">
                    <component :is="currentView"></component>
                </main>
            </div>
        `,
    });

    // Register components globally
    if (window.StatusBadge) app.component('status-badge', window.StatusBadge);
    if (window.TabsComponent) app.component('tabs-component', window.TabsComponent);
    if (window.ToastContainer) app.component('toast-container', window.ToastContainer);
    if (window.ConnectionStatusComponent) app.component('connection-status-component', window.ConnectionStatusComponent);
    if (window.TaskCard) app.component('task-card', window.TaskCard);
    if (window.EditorComponent) app.component('editor-component', window.EditorComponent);

    // Register view components
    if (window.DashboardView) app.component('dashboard-view', window.DashboardView);
    if (window.ProjectView) app.component('project-view', window.ProjectView);
    if (window.TaskView) app.component('task-view', window.TaskView);

    // Mount app to #app element
    app.mount('#app');

    console.log('[App] Vue app mounted');

})(window);
