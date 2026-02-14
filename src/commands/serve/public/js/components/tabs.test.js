/**
 * Tests for TabsComponent
 */

beforeAll(() => {
    if (typeof global.window === 'undefined') {
        global.window = global;
    }
});

describe('TabsComponent', () => {
    let TabsComponent;

    beforeEach(() => {
        jest.resetModules();
        delete global.window.TabsComponent;
        require('./tabs');
        TabsComponent = global.window.TabsComponent;
    });

    test('should be defined on window', () => {
        expect(TabsComponent).toBeDefined();
        expect(TabsComponent.name).toBe('TabsComponent');
    });

    test('should have required tabs and activeTab props', () => {
        expect(TabsComponent.props.tabs.type).toBe(Array);
        expect(TabsComponent.props.tabs.required).toBe(true);
        expect(TabsComponent.props.activeTab.type).toBe(String);
        expect(TabsComponent.props.activeTab.required).toBe(true);
    });

    test('should declare tab-change emit', () => {
        expect(TabsComponent.emits).toContain('tab-change');
    });

    describe('selectTab', () => {
        test('should emit tab-change with the tab id', () => {
            const context = {
                $emit: jest.fn(),
            };

            TabsComponent.methods.selectTab.call(context, 'blueprint');

            expect(context.$emit).toHaveBeenCalledWith('tab-change', 'blueprint');
        });

        test('should emit different tab ids', () => {
            const context = { $emit: jest.fn() };

            TabsComponent.methods.selectTab.call(context, 'overview');
            TabsComponent.methods.selectTab.call(context, 'execution');

            expect(context.$emit).toHaveBeenCalledTimes(2);
            expect(context.$emit).toHaveBeenNthCalledWith(1, 'tab-change', 'overview');
            expect(context.$emit).toHaveBeenNthCalledWith(2, 'tab-change', 'execution');
        });
    });

    test('should have template with active class binding', () => {
        expect(typeof TabsComponent.template).toBe('string');
        expect(TabsComponent.template).toContain('active');
        expect(TabsComponent.template).toContain('selectTab');
    });
});
