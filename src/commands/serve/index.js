/**
 * Serve Command
 * Starts development web server for Claudiomiro web UI
 */

const chalk = require('chalk');
const { createServer, startServer } = require('./server');

/**
 * Parse command line arguments for serve command
 * @param {string[]} args - Command line arguments
 * @returns {Object} - Parsed options
 */
const parseArgs = (args) => {
    const options = {
        port: 3000,
        host: 'localhost',
        open: false,
        projects: [],
        folder: process.cwd(),
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg.startsWith('--port=')) {
            options.port = parseInt(arg.split('=')[1], 10);
        } else if (arg.startsWith('--host=')) {
            options.host = arg.split('=')[1];
        } else if (arg === '--open') {
            options.open = true;
        } else if (arg.startsWith('--projects=')) {
            options.projects = arg.split('=')[1].split(',').map(p => p.trim());
        } else if (!arg.startsWith('--')) {
            // First non-flag argument is the folder
            options.folder = arg;
        }
    }

    return options;
};

/**
 * Main run function for serve command
 * @param {string[]} args - Command line arguments
 */
const run = async (args) => {
    const options = parseArgs(args);

    console.log(chalk.cyan('\n  Starting Claudiomiro Web UI...\n'));

    try {
        const server = createServer({
            port: options.port,
            host: options.host,
            projectPaths: options.projects.length > 0 ? options.projects : [options.folder],
        });

        await startServer(server);

        const url = `http://${options.host}:${options.port}`;

        console.log(chalk.green('  ✓ Server started successfully\n'));
        console.log(chalk.white(`    URL:  ${chalk.cyan(url)}`));
        console.log(chalk.gray(`    Host: ${server.host}`));
        console.log(chalk.gray(`    Port: ${server.port}\n`));

        if (options.open) {
            console.log(chalk.gray('  Opening browser...\n'));
        }

        console.log(chalk.gray('  Press Ctrl+C to stop\n'));

        // Graceful shutdown handler
        const shutdown = () => {
            console.log(chalk.yellow('\n  Shutting down server...\n'));

            // Close WebSocket handler (stops watchers, closes connections)
            if (server.wsHandler) {
                server.wsHandler.shutdown();
            }

            server.httpServer.close(() => {
                console.log(chalk.green('  Server stopped\n'));
                process.exit(0);
            });
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);

    } catch (error) {
        console.error(chalk.red('\n  Failed to start server:\n'));
        console.error(chalk.red(`  ${error.message}\n`));
        process.exit(1);
    }
};

module.exports = { run, parseArgs };
