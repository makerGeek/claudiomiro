/**
 * Tests for ToastContainer component
 */

beforeAll(() => {
    if (typeof global.window === 'undefined') {
        global.window = global;
    }
});

describe('ToastContainer', () => {
    let ToastContainer;
    let savedStore;

    beforeEach(() => {
        jest.resetModules();
        savedStore = global.window.Store;
        delete global.window.ToastContainer;
        require('./toast');
        ToastContainer = global.window.ToastContainer;
    });

    afterEach(() => {
        if (savedStore !== undefined) {
            global.window.Store = savedStore;
        } else {
            delete global.window.Store;
        }
    });

    test('should be defined on window', () => {
        expect(ToastContainer).toBeDefined();
        expect(ToastContainer.name).toBe('ToastContainer');
    });

    describe('toasts computed', () => {
        test('should return Store.state.toasts when Store is available', () => {
            const mockToasts = [
                { id: 1, message: 'Success', type: 'success' },
                { id: 2, message: 'Error', type: 'error' },
            ];
            global.window.Store = { state: { toasts: mockToasts } };

            const result = ToastContainer.computed.toasts.call({});
            expect(result).toEqual(mockToasts);
        });

        test('should return empty array when Store is not available', () => {
            delete global.window.Store;
            const result = ToastContainer.computed.toasts.call({});
            expect(result).toEqual([]);
        });

        test('should return empty array when Store.state.toasts is empty', () => {
            global.window.Store = { state: { toasts: [] } };
            const result = ToastContainer.computed.toasts.call({});
            expect(result).toEqual([]);
        });
    });

    describe('dismiss', () => {
        test('should call Store.removeToast with the toast id', () => {
            global.window.Store = { removeToast: jest.fn() };

            ToastContainer.methods.dismiss.call({}, 42);

            expect(global.window.Store.removeToast).toHaveBeenCalledWith(42);
        });

        test('should not throw when Store is not available', () => {
            delete global.window.Store;

            expect(() => {
                ToastContainer.methods.dismiss.call({}, 1);
            }).not.toThrow();
        });
    });

    test('should have template with toast-container class', () => {
        expect(typeof ToastContainer.template).toBe('string');
        expect(ToastContainer.template).toContain('toast-container');
        expect(ToastContainer.template).toContain('dismiss');
    });
});
