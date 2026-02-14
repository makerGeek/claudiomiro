/**
 * Claudiomiro Web UI - Tabs Component
 *
 * Tab navigation component with active state styling.
 * Emits 'tab-change' when user clicks a tab.
 */

(function (window) {
    'use strict';

    window.TabsComponent = {
        name: 'TabsComponent',

        props: {
            tabs: {
                type: Array,
                required: true,
                // Array of { id: string, label: string }
            },
            activeTab: {
                type: String,
                required: true,
            },
        },

        emits: ['tab-change'],

        methods: {
            selectTab(tabId) {
                this.$emit('tab-change', tabId);
            },
        },

        template: `
            <div class="tabs">
                <button
                    v-for="tab in tabs"
                    :key="tab.id"
                    :class="['tab', { active: activeTab === tab.id }]"
                    @click="selectTab(tab.id)"
                >
                    {{ tab.label }}
                </button>
            </div>
        `,
    };

})(window);
