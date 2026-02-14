/**
 * Unit tests for path-utils.js
 */

const fs = require('fs');
const path = require('path');
const { validateProjectPath, getTaskExecutorPath, decodeProjectPath, sendSuccess, sendError } = require('./path-utils');

// Mock fs module
jest.mock('fs');

describe('path-utils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('validateProjectPath', () => {
        test('should reject paths containing ".."', () => {
            const result = validateProjectPath('/some/path/../etc/passwd');

            expect(result.valid).toBe(false);
            expect(result.error).toContain('traversal');
        });

        test('should reject non-existent paths', () => {
            fs.existsSync.mockReturnValue(false);

            const result = validateProjectPath('/nonexistent/path');

            expect(result.valid).toBe(false);
            expect(result.error).toContain('does not exist');
        });

        test('should reject paths that are not directories', () => {
            fs.existsSync.mockReturnValue(true);
            fs.statSync.mockReturnValue({ isDirectory: () => false });

            const result = validateProjectPath('/some/file.txt');

            expect(result.valid).toBe(false);
            expect(result.error).toContain('not a directory');
        });

        test('should reject paths without .claudiomiro/task-executor/', () => {
            fs.existsSync.mockImplementation((p) => {
                if (p.includes('.claudiomiro')) return false;
                return true;
            });
            fs.statSync.mockReturnValue({ isDirectory: () => true });

            const result = validateProjectPath('/some/project');

            expect(result.valid).toBe(false);
            expect(result.error).toContain('.claudiomiro/task-executor/');
        });

        test('should accept valid project path', () => {
            fs.existsSync.mockReturnValue(true);
            fs.statSync.mockReturnValue({ isDirectory: () => true });

            const result = validateProjectPath('/valid/project');

            expect(result.valid).toBe(true);
            expect(result.resolvedPath).toBeDefined();
        });

        test('should reject paths not in allowedPaths list', () => {
            fs.existsSync.mockReturnValue(true);
            fs.statSync.mockReturnValue({ isDirectory: () => true });

            const result = validateProjectPath('/unauthorized/project', ['/allowed/project1', '/allowed/project2']);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('not in the allowed paths');
        });

        test('should accept paths in allowedPaths list', () => {
            fs.existsSync.mockReturnValue(true);
            fs.statSync.mockReturnValue({ isDirectory: () => true });

            const projectPath = path.resolve('/allowed/project1');
            const result = validateProjectPath(projectPath, ['/allowed/project1', '/allowed/project2']);

            expect(result.valid).toBe(true);
        });

        test('should handle URL-encoded paths', () => {
            fs.existsSync.mockReturnValue(false);

            const result = validateProjectPath('/path%20with%20spaces');

            expect(result.valid).toBe(false);
            // Path should be decoded before validation
        });
    });

    describe('getTaskExecutorPath', () => {
        test('should return correct path', () => {
            const projectPath = '/some/project';
            const result = getTaskExecutorPath(projectPath);

            expect(result).toBe(path.join(projectPath, '.claudiomiro', 'task-executor'));
        });

        test('should work with trailing slash', () => {
            const projectPath = '/some/project/';
            const result = getTaskExecutorPath(projectPath);

            expect(result).toContain('.claudiomiro');
            expect(result).toContain('task-executor');
        });
    });

    describe('decodeProjectPath', () => {
        test('should decode URL-encoded path', () => {
            const encoded = '/path%20with%20spaces';
            const result = decodeProjectPath(encoded);

            expect(result).toBe('/path with spaces');
        });

        test('should handle already decoded paths', () => {
            const plain = '/plain/path';
            const result = decodeProjectPath(plain);

            expect(result).toBe(plain);
        });

        test('should handle malformed encoding gracefully', () => {
            const malformed = '/path%';
            const result = decodeProjectPath(malformed);

            // Should return original on error
            expect(result).toBe(malformed);
        });
    });

    describe('sendSuccess', () => {
        test('should send success response with correct format', () => {
            const mockRes = {
                json: jest.fn(),
            };
            const data = { foo: 'bar' };

            sendSuccess(mockRes, data);

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data,
            });
        });
    });

    describe('sendError', () => {
        test('should send error response with correct format', () => {
            const mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            sendError(mockRes, 400, 'Bad request');

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Bad request',
            });
        });

        test('should work with 500 error code', () => {
            const mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            sendError(mockRes, 500, 'Internal server error');

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Internal server error',
            });
        });
    });
});
