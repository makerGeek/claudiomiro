/**
 * Claudiomiro Web UI - Dashboard View
 *
 * Project list view showing registered projects with status summaries.
 * Route: #/ (dashboard)
 */

(function (window) {
    'use strict';

    window.DashboardView = {
        name: 'DashboardView',

        data() {
            return {
                loading: false,
            };
        },

        computed: {
            projects() {
                return window.Store ? window.Store.state.projects : [];
            },
        },

        async mounted() {
            await this.loadProjects();
        },

        methods: {
            async loadProjects() {
                if (!window.Api || !window.Store) return;

                this.loading = true;
                window.Store.setLoading('projects', true);

                try {
                    var projects = await window.Api.getProjects();
                    window.Store.setProjects(projects);
                } catch (error) {
                    console.error('[Dashboard] Failed to load projects:', error);
                    window.Store.addToast({
                        message: 'Failed to load projects: ' + error.message,
                        type: 'error',
                    });
                } finally {
                    this.loading = false;
                    window.Store.setLoading('projects', false);
                }
            },

            navigateToProject(projectPath) {
                if (window.Router) {
                    window.Router.navigate('/project/' + projectPath);
                }
            },

            getTaskSummary(project) {
                if (!project.tasks || !Array.isArray(project.tasks)) return null;
                var summary = { total: project.tasks.length, completed: 0, failed: 0, running: 0, pending: 0 };
                project.tasks.forEach(function (t) {
                    if (t.status === 'completed') summary.completed++;
                    else if (t.status === 'failed') summary.failed++;
                    else if (t.status === 'in_progress' || t.status === 'running') summary.running++;
                    else summary.pending++;
                });
                return summary;
            },
        },

        template: `
            <div>
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h2>Projects</h2>
                    <button class="btn btn-secondary" @click="loadProjects" :disabled="loading">
                        {{ loading ? 'Loading...' : 'Refresh' }}
                    </button>
                </div>

                <div v-if="loading" class="loading">
                    <div class="spinner"></div>
                </div>

                <div v-else-if="projects.length === 0" class="text-muted text-center mt-5">
                    <p>No projects found.</p>
                    <p>Run <code>claudiomiro</code> in a project directory first.</p>
                </div>

                <div v-else>
                    <div
                        v-for="project in projects"
                        :key="project.path"
                        class="card"
                        style="cursor: pointer;"
                        @click="navigateToProject(project.path)"
                    >
                        <h3 class="card-title">{{ project.name || project.path }}</h3>
                        <p class="card-subtitle">{{ project.path }}</p>
                        <div class="card-body">
                            <span v-if="project.taskCount !== undefined" class="text-muted">
                                {{ project.taskCount }} tasks
                            </span>
                            <span v-if="getTaskSummary(project)" class="text-muted" style="font-size: 0.8rem; margin-left: 1rem;">
                                {{ getTaskSummary(project).completed }} done,
                                {{ getTaskSummary(project).running }} running,
                                {{ getTaskSummary(project).failed }} failed
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        `,
    };

})(window);
