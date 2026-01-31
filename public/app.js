// State
let data = { businesses: [], columns: [], tasks: [], assignees: [] };
let activities = [];
let currentFilter = 'all';
let assigneeFilter = 'all';
let columnObserver = null;
let currentColumnIndex = 0;
let pendingOutcomeCallback = null;

// DOM Elements
const board = document.getElementById('board');
const completedList = document.getElementById('completedList');
const activityList = document.getElementById('activityList');
const activityToggle = document.getElementById('activityToggle');
const businessFilter = document.getElementById('businessFilter');
const assigneeFilterEl = document.getElementById('assigneeFilter');
const taskModal = document.getElementById('taskModal');
const taskForm = document.getElementById('taskForm');
const modalTitle = document.getElementById('modalTitle');
const newTaskBtn = document.getElementById('newTaskBtn');
const modalClose = document.getElementById('modalClose');
const cancelBtn = document.getElementById('cancelBtn');
const saveBtn = document.getElementById('saveBtn');
const mobilePrev = document.getElementById('mobilePrev');
const mobileNext = document.getElementById('mobileNext');
const mobileNewTask = document.getElementById('mobileNewTask');
const mobileColumnName = document.getElementById('mobileColumnName');
const outcomeModal = document.getElementById('outcomeModal');
const outcomeText = document.getElementById('outcomeText');
const outcomeCancel = document.getElementById('outcomeCancel');
const outcomeSubmit = document.getElementById('outcomeSubmit');

// Editable/Readonly elements
const editableFields = document.getElementById('editableFields');
const readonlyFields = document.getElementById('readonlyFields');
const readonlyTitle = document.getElementById('readonlyTitle');
const readonlyDescription = document.getElementById('readonlyDescription');
const outcomeDisplay = document.getElementById('outcomeDisplay');
const readonlyOutcome = document.getElementById('readonlyOutcome');

// Initialize
async function init() {
  await loadData();
  await loadActivity();
  renderBoard();
  renderCompleted();
  renderActivity();
  setupEventListeners();
}

// API calls
async function loadData() {
  const res = await fetch('/api/data');
  data = await res.json();
  populateFilters();
}

async function loadActivity() {
  const res = await fetch('/api/activity');
  const result = await res.json();
  activities = result.activities;
}

async function createTask(taskData) {
  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(taskData)
  });
  return res.json();
}

async function updateTask(id, updates) {
  const res = await fetch(`/api/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  return res.json();
}

async function deleteTask(id) {
  await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
}

// Rendering
function populateFilters() {
  // Business filter
  businessFilter.innerHTML = '<option value="all">All Businesses</option>';
  data.businesses.forEach(b => {
    businessFilter.innerHTML += `<option value="${b.id}">${b.name}</option>`;
  });

  // Assignee filter
  if (assigneeFilterEl) {
    assigneeFilterEl.innerHTML = '<option value="all">All Assignees</option>';
    (data.assignees || []).forEach(a => {
      assigneeFilterEl.innerHTML += `<option value="${a.id}">${a.name}</option>`;
    });
  }

  // Task form - business
  const taskBusiness = document.getElementById('taskBusiness');
  taskBusiness.innerHTML = '';
  data.businesses.forEach(b => {
    taskBusiness.innerHTML += `<option value="${b.id}">${b.name}</option>`;
  });

  // Task form - assignee
  const taskAssignee = document.getElementById('taskAssignee');
  if (taskAssignee) {
    taskAssignee.innerHTML = '';
    (data.assignees || []).forEach(a => {
      taskAssignee.innerHTML += `<option value="${a.id}">${a.name}</option>`;
    });
  }

  // Task form - column
  const taskColumn = document.getElementById('taskColumn');
  taskColumn.innerHTML = '';
  data.columns.forEach(c => {
    taskColumn.innerHTML += `<option value="${c.id}">${c.name}</option>`;
  });
}

function renderBoard() {
  board.innerHTML = '';

  // Only show columns up to "Review" - Done is shown in Completed sidebar
  const visibleColumns = data.columns
    .filter(c => c.id !== 'done')
    .sort((a, b) => a.order - b.order);

  visibleColumns.forEach(column => {
    const columnEl = document.createElement('div');
    columnEl.className = 'column';
    columnEl.dataset.column = column.id;

    const filteredTasks = data.tasks.filter(t => {
      const matchesColumn = t.column === column.id;
      const matchesBusiness = currentFilter === 'all' || t.business === currentFilter;
      const matchesAssignee = assigneeFilter === 'all' || t.assignee === assigneeFilter;
      return matchesColumn && matchesBusiness && matchesAssignee;
    });

    columnEl.innerHTML = `
      <div class="column-header">
        <span>${column.name}</span>
        <span class="count">${filteredTasks.length}</span>
      </div>
      <div class="column-content" data-column="${column.id}">
        ${filteredTasks.length === 0 ? '<div class="empty-state">No tasks</div>' : ''}
      </div>
    `;

    const content = columnEl.querySelector('.column-content');

    filteredTasks.forEach(task => {
      const business = data.businesses.find(b => b.id === task.business);
      const assignee = (data.assignees || []).find(a => a.id === task.assignee);
      const taskEl = document.createElement('div');
      taskEl.className = 'task-card';
      taskEl.dataset.id = task.id;
      taskEl.draggable = true;

      // Show outcome in Review column if it exists
      const showOutcome = column.id === 'review' && task.outcome;

      taskEl.innerHTML = `
        <div class="task-title">${escapeHtml(task.title)}</div>
        ${task.description ? `<div class="task-description">${escapeHtml(task.description)}</div>` : ''}
        ${showOutcome ? `
          <div class="task-outcome">
            <div class="task-outcome-label">Outcome</div>
            ${linkifyOutcome(task.outcome)}
          </div>
        ` : ''}
        <div class="task-meta">
          <span class="task-business" style="background: ${business?.color || '#64748b'}; color: #fff;">
            ${business?.name || 'Unknown'}
          </span>
          <span class="task-assignee" style="background: ${assignee?.color || '#64748b'}; color: #fff;">
            ${assignee?.name || 'Unassigned'}
          </span>
          <span class="task-priority ${task.priority}">${task.priority}</span>
        </div>
      `;

      content.appendChild(taskEl);
    });

    board.appendChild(columnEl);
  });

  setupDragAndDrop();
  setupMobileColumns();
}

function getFilteredCompletedTasks() {
  return data.tasks
    .filter(t => {
      const matchesColumn = t.column === 'done';
      const matchesBusiness = currentFilter === 'all' || t.business === currentFilter;
      const matchesAssignee = assigneeFilter === 'all' || t.assignee === assigneeFilter;
      return matchesColumn && matchesBusiness && matchesAssignee;
    })
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function renderCompleted() {
  if (!completedList) return;
  
  completedList.innerHTML = '';

  const completedTasks = getFilteredCompletedTasks().slice(0, 8);

  if (completedTasks.length === 0) {
    completedList.innerHTML = '<div class="empty-state">No completed tasks</div>';
    return;
  }

  completedTasks.forEach(task => {
    const business = data.businesses.find(b => b.id === task.business);
    const item = document.createElement('div');
    item.className = 'completed-item';
    item.innerHTML = `
      <div class="completed-item-title">${escapeHtml(task.title)}</div>
      ${task.outcome ? `<div class="completed-item-outcome">${linkifyOutcome(task.outcome)}</div>` : ''}
      <div class="completed-item-meta">
        <span class="completed-item-business" style="background: ${business?.color || '#64748b'}; color: #fff;">
          ${business?.name || 'Unknown'}
        </span>
        <span class="completed-item-time">${formatTime(task.updatedAt)}</span>
      </div>
    `;
    completedList.appendChild(item);
  });
}

function renderActivity() {
  if (!activityList) return;
  
  activityList.innerHTML = '';

  activities.slice(0, 15).forEach(activity => {
    const item = document.createElement('div');
    item.className = 'activity-item';
    item.innerHTML = `
      <span class="action">${activity.action}</span>: ${escapeHtml(activity.details)}
      <span class="time">${formatTime(activity.timestamp)}</span>
    `;
    activityList.appendChild(item);
  });

  if (activities.length === 0) {
    activityList.innerHTML = '<div class="empty-state">No activity yet</div>';
  }
}

// Event Listeners
function setupEventListeners() {
  businessFilter.addEventListener('change', (e) => {
    currentFilter = e.target.value;
    renderBoard();
    renderCompleted();
  });

  if (assigneeFilterEl) {
    assigneeFilterEl.addEventListener('change', (e) => {
      assigneeFilter = e.target.value;
      renderBoard();
      renderCompleted();
    });
  }

  newTaskBtn.addEventListener('click', () => openModal());
  mobileNewTask.addEventListener('click', () => openModal());

  modalClose.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  taskModal.addEventListener('click', (e) => {
    if (e.target === taskModal) closeModal();
  });

  taskForm.addEventListener('submit', handleSubmit);

  board.addEventListener('click', (e) => {
    const card = e.target.closest('.task-card');
    if (card) {
      const task = data.tasks.find(t => t.id === card.dataset.id);
      if (task) openModal(task);
    }
  });

  mobilePrev.addEventListener('click', () => scrollToColumn(currentColumnIndex - 1));
  mobileNext.addEventListener('click', () => scrollToColumn(currentColumnIndex + 1));

  // Activity toggle
  if (activityToggle) {
    activityToggle.addEventListener('click', () => {
      activityToggle.classList.toggle('expanded');
      activityList.classList.toggle('expanded');
    });
  }

  // Outcome modal
  outcomeCancel.addEventListener('click', closeOutcomeModal);
  outcomeSubmit.addEventListener('click', submitOutcome);
  outcomeModal.addEventListener('click', (e) => {
    if (e.target === outcomeModal) closeOutcomeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeOutcomeModal();
    }
  });
}

function setupDragAndDrop() {
  const cards = document.querySelectorAll('.task-card');
  const columns = document.querySelectorAll('.column-content');

  cards.forEach(card => {
    card.addEventListener('dragstart', (e) => {
      card.classList.add('dragging');
      e.dataTransfer.setData('text/plain', card.dataset.id);
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    });
  });

  columns.forEach(column => {
    column.addEventListener('dragover', (e) => {
      e.preventDefault();
      column.classList.add('drag-over');
    });

    column.addEventListener('dragleave', () => {
      column.classList.remove('drag-over');
    });

    column.addEventListener('drop', async (e) => {
      e.preventDefault();
      column.classList.remove('drag-over');

      const taskId = e.dataTransfer.getData('text/plain');
      const newColumn = column.dataset.column;
      const task = data.tasks.find(t => t.id === taskId);

      if (!task) return;

      // Check if moving to review from in-progress
      if (newColumn === 'review' && task.column === 'in-progress') {
        openOutcomeModal(task.outcome || '', async (outcome) => {
          // When moving to review, assign to Michael
          await updateTask(taskId, { column: newColumn, outcome, assignee: 'michael' });
          await refresh();
        });
      } else {
        await updateTask(taskId, { column: newColumn });
        await refresh();
      }
    });
  });
}

function setupMobileColumns() {
  const columns = Array.from(document.querySelectorAll('.column'));

  if (columnObserver) {
    columnObserver.disconnect();
  }

  if (!columns.length) return;

  updateMobileIndicator(columns);

  columnObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
        currentColumnIndex = columns.indexOf(entry.target);
        updateMobileIndicator(columns);
      }
    });
  }, {
    root: board,
    threshold: [0.6]
  });

  columns.forEach(col => columnObserver.observe(col));
}

function updateMobileIndicator(columns) {
  const column = columns[currentColumnIndex];
  if (!column) return;
  const columnId = column.dataset.column;
  const columnData = data.columns.find(c => c.id === columnId);
  const count = data.tasks.filter(t => {
    const matchesColumn = t.column === columnId;
    const matchesBusiness = currentFilter === 'all' || t.business === currentFilter;
    const matchesAssignee = assigneeFilter === 'all' || t.assignee === assigneeFilter;
    return matchesColumn && matchesBusiness && matchesAssignee;
  }).length;
  mobileColumnName.textContent = `${columnData?.name || 'Column'} (${count})`;
}

function scrollToColumn(index) {
  const columns = Array.from(document.querySelectorAll('.column'));
  if (!columns.length) return;
  const nextIndex = Math.min(Math.max(index, 0), columns.length - 1);
  currentColumnIndex = nextIndex;
  columns[nextIndex].scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  updateMobileIndicator(columns);
}

// Check if task is editable (only in backlog)
function isTaskEditable(column) {
  return column === 'backlog';
}

// Modal functions
function openModal(task = null) {
  taskModal.classList.add('active');
  
  const taskTitleInput = document.getElementById('taskTitle');
  const taskDescInput = document.getElementById('taskDescription');
  const taskAssignee = document.getElementById('taskAssignee');

  if (task) {
    const editable = isTaskEditable(task.column);
    
    modalTitle.textContent = editable ? 'Edit Task' : 'View Task';
    document.getElementById('taskId').value = task.id;
    document.getElementById('originalColumn').value = task.column;
    
    // Show/hide editable vs readonly fields
    editableFields.style.display = editable ? 'block' : 'none';
    readonlyFields.style.display = editable ? 'none' : 'block';
    
    if (editable) {
      taskTitleInput.value = task.title;
      taskTitleInput.required = true;
      taskDescInput.value = task.description || '';
    } else {
      // Set values in hidden fields too (for form data) but remove required
      taskTitleInput.value = task.title;
      taskTitleInput.required = false;
      taskDescInput.value = task.description || '';
      // Display readonly text
      readonlyTitle.textContent = task.title;
      readonlyDescription.textContent = task.description || '';
    }
    
    // Show outcome section for tasks in Review column (whether outcome exists or not)
    const isReview = task.column === 'review';
    outcomeDisplay.style.display = isReview ? 'block' : 'none';
    if (isReview) {
      if (task.outcome) {
        readonlyOutcome.innerHTML = linkifyOutcome(task.outcome);
      } else {
        readonlyOutcome.innerHTML = '<span style="color: var(--text-muted); font-style: italic;">No outcome recorded yet</span>';
      }
    }
    
    document.getElementById('taskBusiness').value = task.business;
    document.getElementById('taskPriority').value = task.priority;
    document.getElementById('taskColumn').value = task.column;
    if (taskAssignee) taskAssignee.value = task.assignee || 'jarvis';
    
    // Disable business/priority editing if not in backlog, but assignee can always be changed
    document.getElementById('taskBusiness').disabled = !editable;
    document.getElementById('taskPriority').disabled = !editable;
    
    // Update save button text
    saveBtn.textContent = editable ? 'Save Task' : 'Update Status';
  } else {
    modalTitle.textContent = 'New Task';
    taskForm.reset();
    document.getElementById('taskId').value = '';
    document.getElementById('originalColumn').value = '';
    document.getElementById('taskColumn').value = 'backlog';
    if (taskAssignee) taskAssignee.value = 'jarvis';
    
    // Show editable fields for new tasks
    editableFields.style.display = 'block';
    readonlyFields.style.display = 'none';
    outcomeDisplay.style.display = 'none';
    
    // Enable required and all fields
    taskTitleInput.required = true;
    document.getElementById('taskBusiness').disabled = false;
    document.getElementById('taskPriority').disabled = false;
    
    saveBtn.textContent = 'Save Task';
  }

  // Focus title if editable
  if (editableFields.style.display !== 'none') {
    taskTitleInput.focus();
  }
}

function closeModal() {
  taskModal.classList.remove('active');
  taskForm.reset();
  // Re-enable required
  document.getElementById('taskTitle').required = true;
}

// Outcome modal
function openOutcomeModal(currentValue, callback) {
  outcomeText.value = currentValue;
  pendingOutcomeCallback = callback;
  outcomeModal.classList.add('active');
  outcomeText.focus();
}

function closeOutcomeModal() {
  outcomeModal.classList.remove('active');
  outcomeText.value = '';
  pendingOutcomeCallback = null;
}

function submitOutcome() {
  const outcome = outcomeText.value.trim();
  if (!outcome) {
    outcomeText.focus();
    return;
  }
  
  if (pendingOutcomeCallback) {
    pendingOutcomeCallback(outcome);
  }
  closeOutcomeModal();
}

async function handleSubmit(e) {
  e.preventDefault();

  const taskId = document.getElementById('taskId').value;
  const originalColumn = document.getElementById('originalColumn').value;
  const newColumn = document.getElementById('taskColumn').value;
  const editable = !taskId || isTaskEditable(originalColumn);
  const taskAssignee = document.getElementById('taskAssignee');
  
  const taskData = {
    column: newColumn,
    assignee: taskAssignee ? taskAssignee.value : 'jarvis'
  };
  
  // Only include editable fields if in backlog (new task or editing backlog task)
  if (editable) {
    taskData.title = document.getElementById('taskTitle').value;
    taskData.description = document.getElementById('taskDescription').value;
    taskData.business = document.getElementById('taskBusiness').value;
    taskData.priority = document.getElementById('taskPriority').value;
  }

  // Check if moving to review from in-progress
  const movingToReview = newColumn === 'review' && originalColumn === 'in-progress';

  if (movingToReview) {
    closeModal();
    const existingTask = data.tasks.find(t => t.id === taskId);
    openOutcomeModal(existingTask?.outcome || '', async (outcome) => {
      taskData.outcome = outcome;
      taskData.assignee = 'michael'; // Auto-assign to Michael when moving to review
      await updateTask(taskId, taskData);
      await refresh();
    });
  } else {
    if (taskId) {
      await updateTask(taskId, taskData);
    } else {
      await createTask(taskData);
    }
    closeModal();
    await refresh();
  }
}

async function refresh() {
  await loadData();
  await loadActivity();
  renderBoard();
  renderCompleted();
  renderActivity();
}

// Helpers
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function linkifyOutcome(text) {
  if (!text) return '';
  const escaped = escapeHtml(text);
  // Convert newlines to <br>
  const withBreaks = escaped.replace(/\n/g, '<br>');
  // Linkify URLs
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  return withBreaks.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Start
init();
