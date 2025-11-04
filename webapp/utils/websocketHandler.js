/**
 * Setup WebSocket event handlers
 */
function setupWebSocketHandlers(io, taskController) {
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Send initial state when client connects
    socket.emit('connected', {
      message: 'Connected to Claudiomiro webapp',
      config: taskController.config
    });

    // Handle client requesting current tasks
    socket.on('getTasks', () => {
      const tasks = Array.from(taskController.tasks.values());
      socket.emit('tasksList', tasks);
    });

    // Handle client requesting a specific task
    socket.on('getTask', (taskId) => {
      const task = taskController.tasks.get(taskId);
      if (task) {
        socket.emit('taskData', task);
      } else {
        socket.emit('error', { message: 'Task not found' });
      }
    });

    // Handle client disconnection
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });
}

module.exports = { setupWebSocketHandlers };
