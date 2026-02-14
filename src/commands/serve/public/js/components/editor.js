/**
 * Claudiomiro Web UI - Editor Component
 *
 * Textarea editor with monospace font, unsaved changes indicator,
 * save button, and confirm-on-navigate when dirty.
 */

(function (window) {
    'use strict';

    window.EditorComponent = {
        name: 'EditorComponent',

        props: {
            content: {
                type: String,
                default: '',
            },
            readonly: {
                type: Boolean,
                default: false,
            },
            label: {
                type: String,
                default: '',
            },
        },

        emits: ['save'],

        data() {
            return {
                editedContent: this.content || '',
                saving: false,
            };
        },

        computed: {
            dirty() {
                return this.editedContent !== (this.content || '');
            },
            changed() {
                return this.dirty;
            },
            unsaved() {
                return this.dirty;
            },
        },

        watch: {
            content(newVal) {
                // Only reset if not dirty (avoid overwriting user edits)
                if (!this.dirty) {
                    this.editedContent = newVal || '';
                }
            },
        },

        mounted() {
            // Warn user on navigate if there are unsaved changes
            this._beforeUnload = (e) => {
                if (this.dirty) {
                    e.preventDefault();
                    e.returnValue = '';
                }
            };
            window.addEventListener('beforeunload', this._beforeUnload);

            // Listen for hash changes to warn about unsaved changes
            this._hashChange = (e) => {
                if (this.dirty) {
                    var confirmed = window.confirm('You have unsaved changes. Leave without saving?');
                    if (!confirmed) {
                        // Revert hash change
                        e.preventDefault();
                        window.history.pushState(null, '', e.oldURL);
                    }
                }
            };
            window.addEventListener('hashchange', this._hashChange);
        },

        beforeUnmount() {
            window.removeEventListener('beforeunload', this._beforeUnload);
            window.removeEventListener('hashchange', this._hashChange);
        },

        methods: {
            async save() {
                if (this.readonly || this.saving) return;
                this.saving = true;
                try {
                    this.$emit('save', this.editedContent);
                } finally {
                    this.saving = false;
                }
            },
            reset() {
                this.editedContent = this.content || '';
            },
        },

        template: `
            <div class="editor">
                <div class="editor-toolbar">
                    <span v-if="label" style="font-weight: 500; font-size: 0.875rem;">{{ label }}</span>
                    <span v-if="unsaved" style="color: var(--warning); font-size: 0.75rem; margin-left: auto;">
                        Unsaved changes
                    </span>
                    <span v-else style="margin-left: auto;"></span>
                    <button
                        v-if="!readonly"
                        class="btn btn-secondary"
                        :disabled="!dirty"
                        @click="reset"
                        style="font-size: 0.8rem; padding: 0.25rem 0.5rem;"
                    >Reset</button>
                    <button
                        v-if="!readonly"
                        class="btn btn-primary"
                        :disabled="!dirty || saving"
                        @click="save"
                        style="font-size: 0.8rem; padding: 0.25rem 0.5rem;"
                    >{{ saving ? 'Saving...' : 'Save' }}</button>
                </div>
                <div class="editor-content">
                    <textarea
                        v-model="editedContent"
                        :readonly="readonly"
                        rows="20"
                        style="width: 100%; min-height: 300px;"
                    ></textarea>
                </div>
            </div>
        `,
    };

})(window);
