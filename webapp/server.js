const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const TaskController = require('./controllers/taskController');
const { setupWebSocketHandlers } = require('./utils/websocketHandler');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Initialize task controller with socket.io instance
const taskController = new TaskController(io);

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Claudiomiro webapp is running' });
});

// Task routes
app.post('/api/tasks', (req, res) => taskController.createTask(req, res));
app.get('/api/tasks', (req, res) => taskController.getTasks(req, res));
app.get('/api/tasks/:id', (req, res) => taskController.getTask(req, res));
app.delete('/api/tasks/:id', (req, res) => taskController.cancelTask(req, res));

// File serving route
app.get('/api/tasks/:taskId/files/:fileName', (req, res) => taskController.getFile(req, res));

// Configuration routes
app.get('/api/config', (req, res) => taskController.getConfig(req, res));
app.post('/api/config', (req, res) => taskController.updateConfig(req, res));

// WebSocket handlers
setupWebSocketHandlers(io, taskController);

// Serve index.html for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🚀 Claudiomiro webapp is running on http://localhost:${PORT}`);
  console.log(`   - Frontend: http://localhost:${PORT}`);
  console.log(`   - API: http://localhost:${PORT}/api`);
  console.log(`   - WebSocket: ws://localhost:${PORT}`);
  console.log('\nPress Ctrl+C to stop the server\n');
});

module.exports = { app, server, io };
