/**
 * Claudiomiro Web UI - Project View
 *
 * Task list for a project with dependency indicators, status badges, and progress.
 * Route: #/project/:projectPath
 */

(function (window) {
    'use strict';

    window.ProjectView = {
        name: 'ProjectView',

        data() {
            return {
                loading: false,
            };
        },

        computed: {
            projectPath() {
                if (window.Router && window.Router.currentRoute.value) {
                    return window.Router.currentRoute.value.params.projectPath || '';
                }
                return '';
            },
            tasks() {
                return window.Store ? window.Store.state.tasks : [];
            },
            projectName() {
                // Extract project name from path
                var parts = this.projectPath.split('/');
                return parts[parts.length - 1] || this.projectPath;
            },
        },

        watch: {
            projectPath: {
                handler(newPath) {
                    if (newPath) {
                        this.loadTasks();
                        this.connectWebSocket();
                    }
                },
                immediate: true,
            },
        },

        methods: {
            async loadTasks() {
                if (!window.Api || !window.Store || !this.projectPath) return;

                this.loading = true;
                window.Store.setLoading('tasks', true);

                try {
                    var tasks = await window.Api.getTasks(this.projectPath);
                    window.Store.setTasks(tasks);
                } catch (error) {
                    console.error('[Project] Failed to load tasks:', error);
                    window.Store.addToast({
                        message: 'Failed to load tasks: ' + error.message,
                        type: 'error',
                    });
                } finally {
                    this.loading = false;
                    window.Store.setLoading('tasks', false);
                }
            },

            connectWebSocket() {
                if (window.WsClient && this.projectPath) {
                    window.WsClient.connect(this.projectPath);
                }
            },

            goBack() {
                if (window.Router) {
                    window.Router.navigate('/');
                }
            },
        },

        template: `
            <div>
                <div class="mb-3">
                    <a href="#/" style="font-size: 0.875rem;">← Back to Projects</a>
                </div>

                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2>{{ projectName }}</h2>
                        <p class="text-muted" style="font-size: 0.8rem;">{{ projectPath }}</p>
                    </div>
                    <button class="btn btn-secondary" @click="loadTasks" :disabled="loading">
                        {{ loading ? 'Loading...' : 'Refresh' }}
                    </button>
                </div>

                <div v-if="loading" class="loading">
                    <div class="spinner"></div>
                </div>

                <div v-else-if="tasks.length === 0" class="text-muted text-center mt-5">
                    <p>No tasks found for this project.</p>
                </div>

                <div v-else>
                    <task-card
                        v-for="task in tasks"
                        :key="task.id"
                        :task="task"
                        :project-path="projectPath"
                    ></task-card>
                </div>
            </div>
        `,
    };

})(window);
