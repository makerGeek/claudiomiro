/**
 * Claudiomiro Web UI - Task Card Component
 *
 * Displays a task summary card with: ID, title, status badge, current step, progress bar.
 */

(function (window) {
    'use strict';

    window.TaskCard = {
        name: 'TaskCard',

        props: {
            task: {
                type: Object,
                required: true,
            },
            projectPath: {
                type: String,
                default: '',
            },
        },

        computed: {
            title() {
                return this.task.title || this.task.id || 'Untitled';
            },
            currentStep() {
                if (this.task.currentPhase) {
                    return this.task.currentPhase.name || 'Phase ' + this.task.currentPhase.id;
                }
                return null;
            },
            progressPercent() {
                if (!this.task.phases || this.task.phases.length === 0) return 0;
                const completed = this.task.phases.filter(function (p) { return p.status === 'completed'; }).length;
                return Math.round((completed / this.task.phases.length) * 100);
            },
            taskUrl() {
                if (window.Router && this.projectPath) {
                    return window.Router.taskUrl(this.projectPath, this.task.id);
                }
                return '#';
            },
            dependencies() {
                // Dependencies might be in the blueprint metadata or task object
                return this.task.dependencies || [];
            },
        },

        template: `
            <div class="card" style="cursor: pointer;">
                <a :href="taskUrl" style="text-decoration: none; color: inherit; display: block;">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="card-title mb-0">{{ task.id }}</span>
                        <status-badge :status="task.status || 'pending'"></status-badge>
                    </div>
                    <p class="card-subtitle">{{ title }}</p>
                    <div v-if="currentStep" class="text-muted mb-2" style="font-size: 0.8rem;">
                        Current: {{ currentStep }}
                    </div>
                    <div v-if="dependencies.length > 0" class="text-muted mb-2" style="font-size: 0.8rem;">
                        Deps: {{ dependencies.join(', ') }}
                    </div>
                    <div v-if="task.phases && task.phases.length > 0">
                        <div style="background: var(--bg-secondary); border-radius: 4px; height: 6px; overflow: hidden;">
                            <div
                                :style="{ width: progressPercent + '%', background: 'var(--accent)', height: '100%', transition: 'width 0.3s ease' }"
                            ></div>
                        </div>
                        <span class="text-muted" style="font-size: 0.75rem;">{{ progressPercent }}%</span>
                    </div>
                </a>
            </div>
        `,
    };

})(window);
