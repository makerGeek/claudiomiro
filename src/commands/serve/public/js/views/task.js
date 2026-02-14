/**
 * Claudiomiro Web UI - Task Detail View
 *
 * Full task detail with 4 tabs: Overview, Blueprint, Execution, Review.
 * Includes retry and approve buttons.
 * Route: #/project/:projectPath/task/:taskId
 */

(function (window) {
    'use strict';

    window.TaskView = {
        name: 'TaskView',

        data() {
            return {
                activeTab: 'overview',
                loading: false,
                blueprintContent: '',
                blueprintLoading: false,
                executionData: null,
                executionLoading: false,
                executionRaw: '',
                showRawExecution: false,
                reviewContent: '',
                reviewLoading: false,
                retrying: false,
                approving: false,
            };
        },

        computed: {
            projectPath() {
                if (window.Router && window.Router.currentRoute.value) {
                    return window.Router.currentRoute.value.params.projectPath || '';
                }
                return '';
            },
            taskId() {
                if (window.Router && window.Router.currentRoute.value) {
                    return window.Router.currentRoute.value.params.taskId || '';
                }
                return '';
            },
            task() {
                return window.Store ? window.Store.state.currentTask : null;
            },
            tabs() {
                return [
                    { id: 'overview', label: 'Overview' },
                    { id: 'blueprint', label: 'Blueprint' },
                    { id: 'execution', label: 'Execution' },
                    { id: 'review', label: 'Review' },
                ];
            },
            canRetry() {
                return this.task && this.task.status === 'failed';
            },
            canApprove() {
                return this.task && this.reviewContent && this.task.completion &&
                    this.task.completion.status !== 'completed';
            },
            phases() {
                if (this.executionData && this.executionData.phases) {
                    return this.executionData.phases;
                }
                if (this.task && this.task.phases) {
                    return this.task.phases;
                }
                return [];
            },
            artifacts() {
                if (this.executionData && this.executionData.artifacts) {
                    return this.executionData.artifacts;
                }
                if (this.task && this.task.artifacts) {
                    return this.task.artifacts;
                }
                return [];
            },
            uncertainties() {
                if (this.executionData && this.executionData.uncertainties) {
                    return this.executionData.uncertainties;
                }
                return [];
            },
            successCriteria() {
                if (this.executionData && this.executionData.successCriteria) {
                    return this.executionData.successCriteria;
                }
                return [];
            },
            errorHistory() {
                if (this.task && this.task.errorHistory) {
                    return this.task.errorHistory;
                }
                if (this.executionData && this.executionData.errorHistory) {
                    return this.executionData.errorHistory;
                }
                return [];
            },
            completionSummary() {
                var src = this.executionData || this.task;
                if (src && src.completion) {
                    return src.completion;
                }
                return null;
            },
            currentPhase() {
                var src = this.executionData || this.task;
                if (src && src.currentPhase) {
                    return src.currentPhase;
                }
                return null;
            },
        },

        watch: {
            taskId: {
                handler(newId) {
                    if (newId) {
                        this.loadTask();
                    }
                },
                immediate: true,
            },
            activeTab(tab) {
                if (tab === 'blueprint' && !this.blueprintContent) {
                    this.loadBlueprint();
                } else if (tab === 'execution' && !this.executionData) {
                    this.loadExecution();
                } else if (tab === 'review' && !this.reviewContent) {
                    this.loadReview();
                }
            },
        },

        methods: {
            onTabChange(tabId) {
                this.activeTab = tabId;
            },

            async loadTask() {
                if (!window.Api || !window.Store || !this.projectPath || !this.taskId) return;

                this.loading = true;
                window.Store.setLoading('taskDetail', true);

                try {
                    var task = await window.Api.getTask(this.projectPath, this.taskId);
                    window.Store.setCurrentTask(task);
                } catch (error) {
                    console.error('[Task] Failed to load task:', error);
                    window.Store.addToast({
                        message: 'Failed to load task: ' + error.message,
                        type: 'error',
                    });
                } finally {
                    this.loading = false;
                    window.Store.setLoading('taskDetail', false);
                }
            },

            async loadBlueprint() {
                if (!window.Api || !this.projectPath || !this.taskId) return;

                this.blueprintLoading = true;
                try {
                    var result = await window.Api.getBlueprint(this.projectPath, this.taskId);
                    this.blueprintContent = result.content || result || '';
                } catch (error) {
                    console.error('[Task] Failed to load blueprint:', error);
                    this.blueprintContent = '';
                    window.Store.addToast({
                        message: 'Failed to load blueprint: ' + error.message,
                        type: 'error',
                    });
                } finally {
                    this.blueprintLoading = false;
                }
            },

            async loadExecution() {
                if (!window.Api || !this.projectPath || !this.taskId) return;

                this.executionLoading = true;
                try {
                    var result = await window.Api.getExecution(this.projectPath, this.taskId);
                    this.executionData = result;
                    this.executionRaw = JSON.stringify(result, null, 2);
                } catch (error) {
                    console.error('[Task] Failed to load execution:', error);
                    this.executionData = null;
                    window.Store.addToast({
                        message: 'Failed to load execution data: ' + error.message,
                        type: 'error',
                    });
                } finally {
                    this.executionLoading = false;
                }
            },

            async loadReview() {
                if (!window.Api || !this.projectPath || !this.taskId) return;

                this.reviewLoading = true;
                try {
                    var result = await window.Api.getReview(this.projectPath, this.taskId);
                    this.reviewContent = result.content || result || '';
                } catch (error) {
                    console.error('[Task] Failed to load review:', error);
                    this.reviewContent = '';
                    // Don't show error toast for missing reviews — it's normal
                } finally {
                    this.reviewLoading = false;
                }
            },

            async saveBlueprint(content) {
                if (!window.Api || !this.projectPath || !this.taskId) return;

                try {
                    await window.Api.updateBlueprint(this.projectPath, this.taskId, content);
                    this.blueprintContent = content;
                    window.Store.addToast({
                        message: 'Blueprint saved successfully',
                        type: 'success',
                    });
                } catch (error) {
                    console.error('[Task] Failed to save blueprint:', error);
                    window.Store.addToast({
                        message: 'Failed to save blueprint: ' + error.message,
                        type: 'error',
                    });
                }
            },

            async retry() {
                if (!window.Api || !this.projectPath || !this.taskId || this.retrying) return;

                this.retrying = true;
                try {
                    await window.Api.retryTask(this.projectPath, this.taskId);
                    window.Store.addToast({
                        message: 'Task retry initiated',
                        type: 'success',
                    });
                    // Reload task
                    await this.loadTask();
                } catch (error) {
                    console.error('[Task] Failed to retry task:', error);
                    window.Store.addToast({
                        message: 'Failed to retry task: ' + error.message,
                        type: 'error',
                    });
                } finally {
                    this.retrying = false;
                }
            },

            async approve() {
                if (!window.Api || !this.projectPath || !this.taskId || this.approving) return;

                this.approving = true;
                try {
                    await window.Api.approveReview(this.projectPath, this.taskId);
                    window.Store.addToast({
                        message: 'Review approved successfully',
                        type: 'success',
                    });
                    await this.loadTask();
                } catch (error) {
                    console.error('[Task] Failed to approve review:', error);
                    window.Store.addToast({
                        message: 'Failed to approve review: ' + error.message,
                        type: 'error',
                    });
                } finally {
                    this.approving = false;
                }
            },

            toggleRawExecution() {
                this.showRawExecution = !this.showRawExecution;
            },
        },

        template: `
            <div>
                <!-- Breadcrumb -->
                <div class="mb-3" style="font-size: 0.875rem;">
                    <a href="#/">Projects</a>
                    <span class="text-muted"> / </span>
                    <a :href="'#/project/' + projectPath">{{ projectPath }}</a>
                    <span class="text-muted"> / </span>
                    <span class="text-primary">{{ taskId }}</span>
                </div>

                <!-- Loading -->
                <div v-if="loading" class="loading">
                    <div class="spinner"></div>
                </div>

                <!-- Task Header -->
                <div v-else-if="task">
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <div>
                            <h2>{{ task.title || taskId }}</h2>
                            <div class="d-flex align-items-center gap-2 mt-1">
                                <status-badge :status="task.status || 'pending'"></status-badge>
                                <span v-if="task.attempts" class="text-muted" style="font-size: 0.8rem;">
                                    Attempts: {{ task.attempts }}
                                </span>
                            </div>
                        </div>
                        <div class="d-flex gap-2">
                            <button
                                v-if="canRetry"
                                class="btn btn-danger"
                                :disabled="retrying"
                                @click="retry"
                            >{{ retrying ? 'Retrying...' : 'Retry' }}</button>
                            <button
                                v-if="canApprove"
                                class="btn btn-success"
                                :disabled="approving"
                                @click="approve"
                            >{{ approving ? 'Approving...' : 'Approve Review' }}</button>
                        </div>
                    </div>

                    <!-- Tabs -->
                    <tabs-component
                        :tabs="tabs"
                        :active-tab="activeTab"
                        @tab-change="onTabChange"
                    ></tabs-component>

                    <!-- Overview Tab -->
                    <div v-if="activeTab === 'overview'">
                        <div class="card">
                            <h3 class="card-title">Status</h3>
                            <div class="card-body">
                                <p><strong>Status:</strong> <status-badge :status="task.status || 'pending'"></status-badge></p>
                                <p v-if="currentPhase"><strong>Current Phase:</strong> {{ currentPhase.name }} (Phase {{ currentPhase.id }})</p>
                                <p v-if="currentPhase && currentPhase.lastAction"><strong>Last Action:</strong> {{ currentPhase.lastAction }}</p>
                            </div>
                        </div>

                        <div v-if="task.dependencies && task.dependencies.length > 0" class="card">
                            <h3 class="card-title">Dependencies</h3>
                            <div class="card-body">
                                <span v-for="dep in task.dependencies" :key="dep" class="status-badge status-pending" style="margin-right: 0.5rem;">
                                    {{ dep }}
                                </span>
                            </div>
                        </div>

                        <div v-if="errorHistory.length > 0" class="card">
                            <h3 class="card-title">Error History</h3>
                            <div class="card-body">
                                <div v-for="(err, idx) in errorHistory" :key="idx" style="margin-bottom: 0.75rem; padding: 0.5rem; background: var(--bg-secondary); border-radius: 4px;">
                                    <p style="color: var(--error); font-weight: 500;">{{ err.message }}</p>
                                    <p v-if="err.phase" class="text-muted" style="font-size: 0.8rem;">Phase: {{ err.phase }}</p>
                                    <p v-if="err.timestamp" class="text-muted" style="font-size: 0.75rem;">{{ err.timestamp }}</p>
                                    <pre v-if="err.stack" style="font-size: 0.75rem; margin-top: 0.25rem;">{{ err.stack }}</pre>
                                </div>
                            </div>
                        </div>

                        <div v-if="artifacts.length > 0" class="card">
                            <h3 class="card-title">Artifacts</h3>
                            <div class="card-body">
                                <div v-for="artifact in artifacts" :key="artifact.path" style="margin-bottom: 0.25rem; font-size: 0.875rem;">
                                    <span :style="{ color: artifact.verified ? 'var(--success)' : 'var(--text-muted)' }">
                                        {{ artifact.verified ? '✓' : '○' }}
                                    </span>
                                    <code>{{ artifact.path }}</code>
                                    <span class="text-muted" style="font-size: 0.75rem;">({{ artifact.type }})</span>
                                </div>
                            </div>
                        </div>

                        <div v-if="completionSummary" class="card">
                            <h3 class="card-title">Completion</h3>
                            <div class="card-body">
                                <p><strong>Status:</strong> <status-badge :status="completionSummary.status || 'pending'"></status-badge></p>
                                <div v-if="completionSummary.summary && completionSummary.summary.length > 0">
                                    <p><strong>Summary:</strong></p>
                                    <ul>
                                        <li v-for="(s, i) in completionSummary.summary" :key="i">{{ s }}</li>
                                    </ul>
                                </div>
                                <div v-if="completionSummary.deviations && completionSummary.deviations.length > 0">
                                    <p><strong>Deviations:</strong></p>
                                    <ul>
                                        <li v-for="(d, i) in completionSummary.deviations" :key="i">{{ d }}</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Blueprint Tab -->
                    <div v-if="activeTab === 'blueprint'">
                        <div v-if="blueprintLoading" class="loading">
                            <div class="spinner"></div>
                        </div>
                        <editor-component
                            v-else
                            :content="blueprintContent"
                            label="BLUEPRINT.md"
                            @save="saveBlueprint"
                        ></editor-component>
                    </div>

                    <!-- Execution Tab -->
                    <div v-if="activeTab === 'execution'">
                        <div v-if="executionLoading" class="loading">
                            <div class="spinner"></div>
                        </div>
                        <div v-else>
                            <!-- Phases -->
                            <div v-if="phases.length > 0" class="card">
                                <h3 class="card-title">Phases</h3>
                                <div class="card-body">
                                    <div v-for="phase in phases" :key="phase.id" style="margin-bottom: 1rem;">
                                        <div class="d-flex align-items-center gap-2 mb-1">
                                            <strong>Phase {{ phase.id }}: {{ phase.name }}</strong>
                                            <status-badge :status="phase.status"></status-badge>
                                        </div>
                                        <div v-if="phase.items && phase.items.length > 0" style="margin-left: 1rem;">
                                            <div v-for="(item, idx) in phase.items" :key="idx" style="margin-bottom: 0.25rem; font-size: 0.85rem;">
                                                <span :style="{ color: item.completed ? 'var(--success)' : 'var(--text-muted)' }">
                                                    {{ item.completed ? '✓' : '○' }}
                                                </span>
                                                {{ item.description }}
                                                <span v-if="item.evidence" class="text-muted" style="font-size: 0.75rem; display: block; margin-left: 1.25rem;">
                                                    {{ item.evidence }}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Success Criteria -->
                            <div v-if="successCriteria.length > 0" class="card">
                                <h3 class="card-title">Success Criteria</h3>
                                <div class="card-body">
                                    <div v-for="(sc, idx) in successCriteria" :key="idx" style="margin-bottom: 0.5rem; font-size: 0.85rem;">
                                        <span :style="{ color: sc.passed ? 'var(--success)' : (sc.passed === false ? 'var(--error)' : 'var(--text-muted)') }">
                                            {{ sc.passed ? '✓' : (sc.passed === false ? '✗' : '?') }}
                                        </span>
                                        {{ sc.criterion }}
                                        <span v-if="sc.evidence" class="text-muted" style="font-size: 0.75rem;">
                                            — {{ sc.evidence }}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <!-- Uncertainties -->
                            <div v-if="uncertainties.length > 0" class="card">
                                <h3 class="card-title">Uncertainties</h3>
                                <div class="card-body">
                                    <div v-for="u in uncertainties" :key="u.id" style="margin-bottom: 0.5rem;">
                                        <strong>{{ u.id }}:</strong> {{ u.topic }}
                                        <br>
                                        <span class="text-muted" style="font-size: 0.85rem;">
                                            Assumption: {{ u.assumption }} ({{ u.confidence }})
                                        </span>
                                        <span v-if="u.resolution" style="font-size: 0.85rem; display: block; color: var(--success);">
                                            Resolved: {{ u.resolution }}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <!-- Raw JSON Toggle -->
                            <div class="card">
                                <div class="d-flex justify-content-between align-items-center">
                                    <h3 class="card-title mb-0">Raw execution.json</h3>
                                    <button class="btn btn-secondary" @click="toggleRawExecution" style="font-size: 0.8rem; padding: 0.25rem 0.5rem;">
                                        {{ showRawExecution ? 'Hide' : 'Show' }}
                                    </button>
                                </div>
                                <div v-if="showRawExecution" class="mt-3">
                                    <pre style="max-height: 500px; overflow: auto;">{{ executionRaw }}</pre>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Review Tab -->
                    <div v-if="activeTab === 'review'">
                        <div v-if="reviewLoading" class="loading">
                            <div class="spinner"></div>
                        </div>
                        <div v-else-if="!reviewContent" class="text-muted text-center mt-5">
                            <p>No code review available for this task yet.</p>
                        </div>
                        <div v-else>
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <h3>Code Review</h3>
                                <button
                                    v-if="canApprove"
                                    class="btn btn-success"
                                    :disabled="approving"
                                    @click="approve"
                                >{{ approving ? 'Approving...' : 'Approve Review' }}</button>
                            </div>
                            <editor-component
                                :content="reviewContent"
                                :readonly="true"
                                label="CODE_REVIEW.md"
                            ></editor-component>
                        </div>
                    </div>
                </div>

                <!-- Task not found -->
                <div v-else class="text-muted text-center mt-5">
                    <p>Task not found or still loading.</p>
                    <a :href="'#/project/' + projectPath">← Back to Project</a>
                </div>
            </div>
        `,
    };

})(window);
