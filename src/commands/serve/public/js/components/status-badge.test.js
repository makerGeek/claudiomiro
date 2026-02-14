/**
 * Tests for StatusBadge component
 */

beforeAll(() => {
    if (typeof global.window === 'undefined') {
        global.window = global;
    }
});

describe('StatusBadge', () => {
    let StatusBadge;

    beforeEach(() => {
        jest.resetModules();
        delete global.window.StatusBadge;
        require('./status-badge');
        StatusBadge = global.window.StatusBadge;
    });

    test('should be defined on window', () => {
        expect(StatusBadge).toBeDefined();
        expect(StatusBadge.name).toBe('StatusBadge');
    });

    test('should have status prop with default "pending"', () => {
        expect(StatusBadge.props.status.type).toBe(String);
        expect(StatusBadge.props.status.default).toBe('pending');
    });

    describe('label', () => {
        function getLabel(status) {
            return StatusBadge.computed.label.call({ status });
        }

        test('should return "Pending" for pending status', () => {
            expect(getLabel('pending')).toBe('Pending');
        });

        test('should return "Running" for running status', () => {
            expect(getLabel('running')).toBe('Running');
        });

        test('should return "In Progress" for in_progress status', () => {
            expect(getLabel('in_progress')).toBe('In Progress');
        });

        test('should return "Completed" for completed status', () => {
            expect(getLabel('completed')).toBe('Completed');
        });

        test('should return "Failed" for failed status', () => {
            expect(getLabel('failed')).toBe('Failed');
        });

        test('should return "Blocked" for blocked status', () => {
            expect(getLabel('blocked')).toBe('Blocked');
        });

        test('should return "Pending Validation" for pending_validation status', () => {
            expect(getLabel('pending_validation')).toBe('Pending Validation');
        });

        test('should return raw status string for unknown status', () => {
            expect(getLabel('custom_status')).toBe('custom_status');
        });
    });

    describe('badgeClass', () => {
        function getBadgeClass(status) {
            return StatusBadge.computed.badgeClass.call({ status });
        }

        test('should return array with status-badge and status-specific class', () => {
            expect(getBadgeClass('completed')).toEqual(['status-badge', 'status-completed']);
        });

        test('should use status-pending when status is falsy', () => {
            expect(getBadgeClass(null)).toEqual(['status-badge', 'status-pending']);
            expect(getBadgeClass(undefined)).toEqual(['status-badge', 'status-pending']);
            expect(getBadgeClass('')).toEqual(['status-badge', 'status-pending']);
        });

        test('should handle all known statuses', () => {
            expect(getBadgeClass('running')).toEqual(['status-badge', 'status-running']);
            expect(getBadgeClass('failed')).toEqual(['status-badge', 'status-failed']);
            expect(getBadgeClass('blocked')).toEqual(['status-badge', 'status-blocked']);
        });
    });

    test('should have a template string', () => {
        expect(typeof StatusBadge.template).toBe('string');
        expect(StatusBadge.template).toContain('badgeClass');
        expect(StatusBadge.template).toContain('label');
    });
});
