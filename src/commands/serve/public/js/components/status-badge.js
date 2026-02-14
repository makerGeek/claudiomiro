/**
 * Claudiomiro Web UI - Status Badge Component
 *
 * Color-coded status indicator for task/phase states.
 * Statuses: pending, running, in_progress, completed, failed, blocked
 */

(function (window) {
    'use strict';

    window.StatusBadge = {
        name: 'StatusBadge',

        props: {
            status: {
                type: String,
                default: 'pending',
            },
        },

        computed: {
            label() {
                const labels = {
                    pending: 'Pending',
                    running: 'Running',
                    in_progress: 'In Progress',
                    completed: 'Completed',
                    failed: 'Failed',
                    blocked: 'Blocked',
                    pending_validation: 'Pending Validation',
                };
                return labels[this.status] || this.status;
            },
            badgeClass() {
                return ['status-badge', 'status-' + (this.status || 'pending')];
            },
        },

        template: `
            <span :class="badgeClass">{{ label }}</span>
        `,
    };

})(window);
