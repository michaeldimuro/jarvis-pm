const express = require('express');
const basicAuth = require('express-basic-auth');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3333;

// Basic Authentication - protects entire app
// Username: michael | Password: synergy2026
app.use(basicAuth({
  users: { 
    'michael': 'synergy2026',
    'jarvis': 'synergy2026'
  },
  challenge: true,
  realm: 'Mission Control'
}));
const DATA_FILE = path.join(__dirname, 'data', 'tasks.json');
const ACTIVITY_FILE = path.join(__dirname, 'data', 'activity.json');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize data files if they don't exist
function initDataFiles() {
  if (!fs.existsSync(DATA_FILE)) {
    const initialData = {
      businesses: [
        { id: 'korn-ferry', name: 'Korn Ferry', color: '#4A90D9' },
        { id: 'capture-health', name: 'Capture Health', color: '#50C878' },
        { id: 'inspectable', name: 'Inspectable', color: '#FF6B6B' },
        { id: 'synergy', name: 'Synergy Property Development', color: '#FFB347' }
      ],
      columns: [
        { id: 'backlog', name: 'Backlog', order: 0 },
        { id: 'todo', name: 'To Do', order: 1 },
        { id: 'in-progress', name: 'In Progress', order: 2 },
        { id: 'blocked', name: 'Blocked', order: 3 },
        { id: 'review', name: 'Review', order: 4 },
        { id: 'done', name: 'Done', order: 5 }
      ],
      assignees: [
        { id: 'michael', name: 'Michael', color: '#8B5CF6' },
        { id: 'jarvis', name: 'Jarvis', color: '#06B6D4' }
      ],
      tasks: []
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
  }
  
  if (!fs.existsSync(ACTIVITY_FILE)) {
    fs.writeFileSync(ACTIVITY_FILE, JSON.stringify({ activities: [] }, null, 2));
  }
}

initDataFiles();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper functions
function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function readActivity() {
  return JSON.parse(fs.readFileSync(ACTIVITY_FILE, 'utf8'));
}

function writeActivity(data) {
  fs.writeFileSync(ACTIVITY_FILE, JSON.stringify(data, null, 2));
}

function logActivity(action, details) {
  const activity = readActivity();
  activity.activities.unshift({
    id: uuidv4(),
    action,
    details,
    timestamp: new Date().toISOString()
  });
  // Keep last 100 activities
  activity.activities = activity.activities.slice(0, 100);
  writeActivity(activity);
}

// API Routes

// Get all data
app.get('/api/data', (req, res) => {
  const data = readData();
  res.json(data);
});

// Get activity log
app.get('/api/activity', (req, res) => {
  const activity = readActivity();
  res.json(activity);
});

// Create task
app.post('/api/tasks', (req, res) => {
  const data = readData();
  const { title, description, business, priority, column, outcome, assignee } = req.body;
  
  const newTask = {
    id: uuidv4(),
    title,
    description: description || '',
    business: business || 'korn-ferry',
    priority: priority || 'medium',
    column: column || 'backlog',
    outcome: outcome || '',
    assignee: assignee || 'jarvis',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  data.tasks.push(newTask);
  writeData(data);
  
  const businessName = data.businesses.find(b => b.id === newTask.business)?.name || business;
  logActivity('created', `Task "${title}" added to ${businessName}`);
  
  res.json(newTask);
});

// Update task
app.put('/api/tasks/:id', (req, res) => {
  const data = readData();
  const taskIndex = data.tasks.findIndex(t => t.id === req.params.id);
  
  if (taskIndex === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  const oldTask = { ...data.tasks[taskIndex] };
  const updates = req.body;
  
  data.tasks[taskIndex] = {
    ...data.tasks[taskIndex],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  writeData(data);
  
  // Log activity based on what changed
  if (updates.column && updates.column !== oldTask.column) {
    const columnName = data.columns.find(c => c.id === updates.column)?.name || updates.column;
    logActivity('moved', `"${data.tasks[taskIndex].title}" moved to ${columnName}`);
  } else {
    logActivity('updated', `"${data.tasks[taskIndex].title}" was updated`);
  }
  
  res.json(data.tasks[taskIndex]);
});

// Delete task
app.delete('/api/tasks/:id', (req, res) => {
  const data = readData();
  const task = data.tasks.find(t => t.id === req.params.id);
  
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  data.tasks = data.tasks.filter(t => t.id !== req.params.id);
  writeData(data);
  
  logActivity('deleted', `Task "${task.title}" was deleted`);
  
  res.json({ success: true });
});

// Start server
app.listen(PORT, () => {
  console.log(`⚡ Mission Control running at http://localhost:${PORT}`);
});
