/**
 * Claudiomiro Web UI - Connection Status Component
 *
 * WebSocket connection indicator showing connected/disconnected/connecting state.
 */

(function (window) {
    'use strict';

    window.ConnectionStatusComponent = {
        name: 'ConnectionStatusComponent',

        computed: {
            status() {
                return window.Store ? window.Store.state.connectionStatus : 'disconnected';
            },
            statusClass() {
                return ['connection-status', this.status];
            },
            label() {
                const labels = {
                    connected: 'Connected',
                    connecting: 'Connecting...',
                    disconnected: 'Disconnected',
                };
                return labels[this.status] || 'Unknown';
            },
        },

        template: `
            <div :class="statusClass">
                <span class="connection-indicator"></span>
                <span>{{ label }}</span>
            </div>
        `,
    };

})(window);
