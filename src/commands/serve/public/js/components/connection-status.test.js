/**
 * Tests for ConnectionStatusComponent
 */

beforeAll(() => {
    if (typeof global.window === 'undefined') {
        global.window = global;
    }
});

describe('ConnectionStatusComponent', () => {
    let ConnectionStatusComponent;
    let savedStore;

    beforeEach(() => {
        jest.resetModules();
        savedStore = global.window.Store;
        delete global.window.ConnectionStatusComponent;
        require('./connection-status');
        ConnectionStatusComponent = global.window.ConnectionStatusComponent;
    });

    afterEach(() => {
        if (savedStore !== undefined) {
            global.window.Store = savedStore;
        } else {
            delete global.window.Store;
        }
    });

    test('should be defined on window', () => {
        expect(ConnectionStatusComponent).toBeDefined();
        expect(ConnectionStatusComponent.name).toBe('ConnectionStatusComponent');
    });

    describe('status computed', () => {
        test('should return Store.state.connectionStatus when Store is available', () => {
            global.window.Store = { state: { connectionStatus: 'connected' } };
            const result = ConnectionStatusComponent.computed.status.call({});
            expect(result).toBe('connected');
        });

        test('should return "disconnected" when Store is not available', () => {
            delete global.window.Store;
            const result = ConnectionStatusComponent.computed.status.call({});
            expect(result).toBe('disconnected');
        });
    });

    describe('statusClass computed', () => {
        test('should return array with connection-status and current status', () => {
            const context = { status: 'connected' };
            const result = ConnectionStatusComponent.computed.statusClass.call(context);
            expect(result).toEqual(['connection-status', 'connected']);
        });

        test('should work with disconnected status', () => {
            const context = { status: 'disconnected' };
            const result = ConnectionStatusComponent.computed.statusClass.call(context);
            expect(result).toEqual(['connection-status', 'disconnected']);
        });

        test('should work with connecting status', () => {
            const context = { status: 'connecting' };
            const result = ConnectionStatusComponent.computed.statusClass.call(context);
            expect(result).toEqual(['connection-status', 'connecting']);
        });
    });

    describe('label computed', () => {
        test('should return "Connected" for connected status', () => {
            const result = ConnectionStatusComponent.computed.label.call({ status: 'connected' });
            expect(result).toBe('Connected');
        });

        test('should return "Connecting..." for connecting status', () => {
            const result = ConnectionStatusComponent.computed.label.call({ status: 'connecting' });
            expect(result).toBe('Connecting...');
        });

        test('should return "Disconnected" for disconnected status', () => {
            const result = ConnectionStatusComponent.computed.label.call({ status: 'disconnected' });
            expect(result).toBe('Disconnected');
        });

        test('should return "Unknown" for unknown status', () => {
            const result = ConnectionStatusComponent.computed.label.call({ status: 'something_else' });
            expect(result).toBe('Unknown');
        });
    });

    test('should have template with connection-indicator', () => {
        expect(typeof ConnectionStatusComponent.template).toBe('string');
        expect(ConnectionStatusComponent.template).toContain('connection-indicator');
    });
});
