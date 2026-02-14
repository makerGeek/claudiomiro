/**
 * Claudiomiro Web UI - Toast Notification Component
 *
 * Renders toast notifications from Store.state.toasts.
 * Auto-dismiss is handled by the Store itself.
 */

(function (window) {
    'use strict';

    window.ToastContainer = {
        name: 'ToastContainer',

        computed: {
            toasts() {
                return window.Store ? window.Store.state.toasts : [];
            },
        },

        methods: {
            dismiss(id) {
                if (window.Store) {
                    window.Store.removeToast(id);
                }
            },
        },

        template: `
            <div class="toast-container" v-if="toasts.length > 0">
                <div
                    v-for="toast in toasts"
                    :key="toast.id"
                    :class="['toast', 'toast-' + toast.type]"
                >
                    <div class="d-flex justify-content-between align-items-center">
                        <span>{{ toast.message }}</span>
                        <button
                            class="btn"
                            style="padding: 0 0.25rem; font-size: 1.25rem; line-height: 1;"
                            @click="dismiss(toast.id)"
                            aria-label="Close"
                        >&times;</button>
                    </div>
                </div>
            </div>
        `,
    };

})(window);
