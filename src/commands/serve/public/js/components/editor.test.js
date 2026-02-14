/**
 * Tests for EditorComponent
 */

beforeAll(() => {
    if (typeof global.window === 'undefined') {
        global.window = global;
    }
    // Ensure addEventListener/removeEventListener exist for Node env
    if (!global.window.addEventListener) {
        global.window.addEventListener = function () {};
    }
    if (!global.window.removeEventListener) {
        global.window.removeEventListener = function () {};
    }
});

describe('EditorComponent', () => {
    let EditorComponent;
    let addEventListenerSpy;
    let removeEventListenerSpy;

    beforeEach(() => {
        jest.resetModules();

        addEventListenerSpy = jest.spyOn(global.window, 'addEventListener').mockImplementation(() => {});
        removeEventListenerSpy = jest.spyOn(global.window, 'removeEventListener').mockImplementation(() => {});

        delete global.window.EditorComponent;
        require('./editor');
        EditorComponent = global.window.EditorComponent;
    });

    afterEach(() => {
        addEventListenerSpy.mockRestore();
        removeEventListenerSpy.mockRestore();
    });

    test('should be defined on window', () => {
        expect(EditorComponent).toBeDefined();
        expect(EditorComponent.name).toBe('EditorComponent');
    });

    test('should have content, readonly, and label props', () => {
        expect(EditorComponent.props.content.type).toBe(String);
        expect(EditorComponent.props.content.default).toBe('');
        expect(EditorComponent.props.readonly.type).toBe(Boolean);
        expect(EditorComponent.props.readonly.default).toBe(false);
        expect(EditorComponent.props.label.type).toBe(String);
    });

    test('should declare save emit', () => {
        expect(EditorComponent.emits).toContain('save');
    });

    describe('data', () => {
        test('should initialize editedContent from content prop', () => {
            const data = EditorComponent.data.call({ content: 'hello' });
            expect(data.editedContent).toBe('hello');
            expect(data.saving).toBe(false);
        });

        test('should default editedContent to empty string when content is null', () => {
            const data = EditorComponent.data.call({ content: null });
            expect(data.editedContent).toBe('');
        });

        test('should default editedContent to empty string when content is undefined', () => {
            const data = EditorComponent.data.call({ content: undefined });
            expect(data.editedContent).toBe('');
        });
    });

    describe('dirty computed', () => {
        test('should return true when editedContent differs from content', () => {
            const context = { editedContent: 'modified', content: 'original' };
            expect(EditorComponent.computed.dirty.call(context)).toBe(true);
        });

        test('should return false when editedContent equals content', () => {
            const context = { editedContent: 'same', content: 'same' };
            expect(EditorComponent.computed.dirty.call(context)).toBe(false);
        });

        test('should handle null content (treat as empty string)', () => {
            const context = { editedContent: '', content: null };
            expect(EditorComponent.computed.dirty.call(context)).toBe(false);
        });

        test('should handle undefined content (treat as empty string)', () => {
            const context = { editedContent: '', content: undefined };
            expect(EditorComponent.computed.dirty.call(context)).toBe(false);
        });

        test('should detect dirty when content is null but editedContent is not empty', () => {
            const context = { editedContent: 'something', content: null };
            expect(EditorComponent.computed.dirty.call(context)).toBe(true);
        });
    });

    describe('changed computed', () => {
        test('should alias dirty', () => {
            const context = { dirty: true };
            expect(EditorComponent.computed.changed.call(context)).toBe(true);
            context.dirty = false;
            expect(EditorComponent.computed.changed.call(context)).toBe(false);
        });
    });

    describe('unsaved computed', () => {
        test('should alias dirty', () => {
            const ctx = { dirty: true };
            expect(EditorComponent.computed.unsaved.call(ctx)).toBe(true);
            ctx.dirty = false;
            expect(EditorComponent.computed.unsaved.call(ctx)).toBe(false);
        });
    });

    describe('save method', () => {
        test('should emit save with editedContent', async () => {
            const context = {
                readonly: false,
                saving: false,
                editedContent: 'new content',
                $emit: jest.fn(),
            };

            await EditorComponent.methods.save.call(context);

            expect(context.$emit).toHaveBeenCalledWith('save', 'new content');
        });

        test('should not emit when readonly is true', async () => {
            const context = {
                readonly: true,
                saving: false,
                editedContent: 'content',
                $emit: jest.fn(),
            };

            await EditorComponent.methods.save.call(context);

            expect(context.$emit).not.toHaveBeenCalled();
        });

        test('should not emit when already saving', async () => {
            const context = {
                readonly: false,
                saving: true,
                editedContent: 'content',
                $emit: jest.fn(),
            };

            await EditorComponent.methods.save.call(context);

            expect(context.$emit).not.toHaveBeenCalled();
        });

        test('should set saving flag during emit and reset after', async () => {
            const savingStates = [];
            const context = {
                readonly: false,
                saving: false,
                editedContent: 'content',
                $emit: jest.fn(() => {
                    savingStates.push(context.saving);
                }),
            };

            await EditorComponent.methods.save.call(context);

            expect(savingStates[0]).toBe(true);
            expect(context.saving).toBe(false);
        });
    });

    describe('reset method', () => {
        test('should reset editedContent to content', () => {
            const context = { content: 'original', editedContent: 'modified' };
            EditorComponent.methods.reset.call(context);
            expect(context.editedContent).toBe('original');
        });

        test('should handle null content', () => {
            const context = { content: null, editedContent: 'modified' };
            EditorComponent.methods.reset.call(context);
            expect(context.editedContent).toBe('');
        });
    });

    describe('mounted', () => {
        test('should register beforeunload and hashchange listeners', () => {
            const context = { dirty: false };
            EditorComponent.mounted.call(context);

            expect(addEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
            expect(addEventListenerSpy).toHaveBeenCalledWith('hashchange', expect.any(Function));
            expect(context._beforeUnload).toBeDefined();
            expect(context._hashChange).toBeDefined();
        });

        test('beforeunload handler should set returnValue when dirty', () => {
            const context = { dirty: true };
            EditorComponent.mounted.call(context);

            const event = { preventDefault: jest.fn(), returnValue: null };
            context._beforeUnload(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(event.returnValue).toBe('');
        });

        test('beforeunload handler should not set returnValue when not dirty', () => {
            const context = { dirty: false };
            EditorComponent.mounted.call(context);

            const event = { preventDefault: jest.fn(), returnValue: null };
            context._beforeUnload(event);

            expect(event.preventDefault).not.toHaveBeenCalled();
            expect(event.returnValue).toBeNull();
        });
    });

    describe('beforeUnmount', () => {
        test('should remove event listeners', () => {
            const beforeUnload = jest.fn();
            const hashChange = jest.fn();
            const context = {
                _beforeUnload: beforeUnload,
                _hashChange: hashChange,
            };

            EditorComponent.beforeUnmount.call(context);

            expect(removeEventListenerSpy).toHaveBeenCalledWith('beforeunload', beforeUnload);
            expect(removeEventListenerSpy).toHaveBeenCalledWith('hashchange', hashChange);
        });
    });

    test('should have template with unsaved indicator', () => {
        expect(typeof EditorComponent.template).toBe('string');
        expect(EditorComponent.template).toContain('Unsaved');
        expect(EditorComponent.template).toContain('save');
        expect(EditorComponent.template).toContain('textarea');
    });
});
