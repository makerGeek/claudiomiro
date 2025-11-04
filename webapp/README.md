# Claudiomiro Webapp

A modern web interface for Claudiomiro - the AI-powered autonomous development automation system.

## Features

- **Task Submission**: Submit development tasks through an intuitive web interface
- **Real-time Monitoring**: Watch your tasks execute in real-time with live progress updates
- **Task Dashboard**: View all active, queued, and completed tasks at a glance
- **WebSocket Integration**: Get instant updates as tasks progress through execution stages
- **Configuration Management**: Customize AI executor, planning mode, and execution parameters
- **Detailed Logs**: View comprehensive logs for each task execution
- **Subtask Tracking**: Monitor progress of individual subtasks within a larger task

## Architecture

```
webapp/
├── server.js                    # Express.js server with Socket.IO
├── controllers/
│   └── taskController.js        # Task management logic
├── utils/
│   └── websocketHandler.js      # WebSocket event handlers
└── public/
    ├── index.html               # Main HTML page
    ├── css/
    │   └── style.css            # Styling
    └── js/
        └── app.js               # Frontend JavaScript
```

## Getting Started

### Installation

1. Install dependencies:

```bash
npm install
```

### Running the Webapp

Start the webapp server:

```bash
npm run webapp
```

Or for development:

```bash
npm run dev:webapp
```

The webapp will be available at:
- Frontend: http://localhost:3000
- API: http://localhost:3000/api
- WebSocket: ws://localhost:3000

### Configuration

You can configure the default settings through the Settings panel in the webapp UI:

- **AI Executor**: Choose between Claude, Codex, Gemini, DeepSeek, or GLM
- **Planning Mode**: Auto (fast) or Hard (reasoning)
- **Max Concurrent Tasks**: Number of parallel tasks (1-10)
- **Cycle Limit**: Maximum execution cycles per task
- **Auto-push to Git**: Automatically push completed work
- **Use Same Branch**: Execute on current branch

## API Endpoints

### Health Check
```
GET /api/health
```

### Task Management

#### Create Task
```
POST /api/tasks
Body: {
  "prompt": "Task description",
  "options": {
    "executor": "claude",
    "mode": "auto",
    "maxConcurrent": 5,
    "push": false,
    "sameBranch": false,
    "limit": 20
  }
}
```

#### Get All Tasks
```
GET /api/tasks
```

#### Get Single Task
```
GET /api/tasks/:id
```

#### Cancel Task
```
DELETE /api/tasks/:id
```

### Configuration

#### Get Configuration
```
GET /api/config
```

#### Update Configuration
```
POST /api/config
Body: {
  "executor": "claude",
  "mode": "auto",
  "maxConcurrent": 5,
  "push": false,
  "sameBranch": false,
  "limit": 20
}
```

## WebSocket Events

### Client → Server

- `getTasks`: Request all tasks
- `getTask`: Request specific task

### Server → Client

- `connected`: Connection established
- `taskCreated`: New task created
- `taskUpdated`: Task status updated
- `taskLog`: New log entry for task
- `tasksList`: List of all tasks

## Technology Stack

- **Backend**: Express.js + Socket.IO
- **Frontend**: Vanilla JavaScript + WebSockets
- **Styling**: Custom CSS with modern design
- **Real-time**: Socket.IO for bidirectional communication

## Features in Detail

### Task Creation
Submit tasks with a natural language prompt describing what you want to build or implement. The system will automatically decompose the task into subtasks and execute them in parallel when possible.

### Real-time Progress
Watch as your tasks progress through the execution pipeline:
1. Task decomposition (Step 0)
2. TODO creation (Step 2)
3. Implementation (Step 3)
4. Code review (Step 4)
5. Commit & push (Step 5)

### Task Dashboard
View all your tasks with:
- Current status (queued, running, completed, failed, cancelled)
- Progress percentage
- Subtask breakdown
- Execution timestamps
- Quick access to detailed logs

### Configuration
Customize execution parameters:
- Choose your preferred AI model
- Set planning mode (fast auto or reasoning hard mode)
- Control parallel execution limits
- Toggle Git operations

## Development

### File Structure

- `server.js`: Main Express server setup with routes and middleware
- `taskController.js`: Core business logic for task management
- `websocketHandler.js`: WebSocket event handling
- `index.html`: Single-page application structure
- `style.css`: Modern, dark-themed UI styling
- `app.js`: Frontend logic and WebSocket client

### Adding Features

To add new features:

1. **Backend**: Add routes in `server.js` and logic in `taskController.js`
2. **WebSocket**: Add event handlers in `websocketHandler.js`
3. **Frontend**: Update `app.js` for logic and `style.css` for styling

## Troubleshooting

### Port Already in Use
If port 3000 is already in use, set a different port:
```bash
PORT=3001 npm run webapp
```

### WebSocket Connection Issues
Ensure no firewall is blocking WebSocket connections. Check browser console for errors.

### Task Execution Failures
Check that:
- Required environment variables are set (API keys for AI models)
- Git is properly configured
- Sufficient permissions for file operations

## License

ISC - Same as Claudiomiro

## Author

Samuel Fajreldines
