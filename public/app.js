// State
let data = { businesses: [], columns: [], tasks: [] };
let activities = [];
let currentFilter = 'all';
let columnObserver = null;
let currentColumnIndex = 0;
let pendingOutcomeCallback = null;
let dateFilterStart = null;
let dateFilterEnd = null;

// DOM Elements
const board = document.getElementById('board');
const completedList = document.getElementById('completedList');
const activityList = document.getElementById('activityList');
const activityToggle = document.getElementById('activityToggle');
const businessFilter = document.getElementById('businessFilter');
const taskModal = document.getElementById('taskModal');
const taskForm = document.getElementById('taskForm');
const modalTitle = document.getElementById('modalTitle');
const newTaskBtn = document.getElementById('newTaskBtn');
const modalClose = document.getElementById('modalClose');
const cancelBtn = document.getElementById('cancelBtn');
const mobilePrev = document.getElementById('mobilePrev');
const mobileNext = document.getElementById('mobileNext');
const mobileNewTask = document.getElementById('mobileNewTask');
const mobileCompleted = document.getElementById('mobileCompleted');
const mobileColumnName = document.getElementById('mobileColumnName');
const outcomeModal = document.getElementById('outcomeModal');
const outcomeText = document.getElementById('outcomeText');
const outcomeCancel = document.getElementById('outcomeCancel');
const outcomeSubmit = document.getElementById('outcomeSubmit');
const completedSheet = document.getElementById('completedSheet');
const closeCompletedSheet = document.getElementById('closeCompletedSheet');
const mobileCompletedList = document.getElementById('mobileCompletedList');
const mobileStartDate = document.getElementById('mobileStartDate');
const mobileEndDate = document.getElementById('mobileEndDate');

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
  businessFilter.innerHTML = '<option value="all">All Businesses</option>';
  data.businesses.forEach(b => {
    businessFilter.innerHTML += `<option value="${b.id}">${b.name}</option>`;
  });

  const taskBusiness = document.getElementById('taskBusiness');
  taskBusiness.innerHTML = '';
  data.businesses.forEach(b => {
    taskBusiness.innerHTML += `<option value="${b.id}">${b.name}</option>`;
  });

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
      const matchesFilter = currentFilter === 'all' || t.business === currentFilter;
      return matchesColumn && matchesFilter;
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
      const taskEl = document.createElement('div');
      taskEl.className = 'task-card';
      taskEl.dataset.id = task.id;
      taskEl.draggable = true;

      // Only show outcome in Review column
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

function getFilteredCompletedTasks(startDate = null, endDate = null) {
  return data.tasks
    .filter(t => {
      const matchesColumn = t.column === 'done';
      const matchesFilter = currentFilter === 'all' || t.business === currentFilter;
      
      // Date filtering
      let matchesDate = true;
      if (startDate || endDate) {
        const taskDate = new Date(t.updatedAt);
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          matchesDate = matchesDate && taskDate >= start;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          matchesDate = matchesDate && taskDate <= end;
        }
      }
      
      return matchesColumn && matchesFilter && matchesDate;
    })
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function renderCompleted() {
  if (!completedList) return;
  
  completedList.innerHTML = '';

  const completedTasks = getFilteredCompletedTasks(dateFilterStart, dateFilterEnd).slice(0, 8);

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

function renderMobileCompleted() {
  if (!mobileCompletedList) return;
  
  mobileCompletedList.innerHTML = '';
  
  const startDate = mobileStartDate?.value || null;
  const endDate = mobileEndDate?.value || null;

  const completedTasks = getFilteredCompletedTasks(startDate, endDate).slice(0, 20);

  if (completedTasks.length === 0) {
    mobileCompletedList.innerHTML = '<div class="empty-state">No completed tasks in this range</div>';
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
    mobileCompletedList.appendChild(item);
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

  // Mobile completed sheet
  if (mobileCompleted) {
    mobileCompleted.addEventListener('click', openCompletedSheet);
  }
  if (closeCompletedSheet) {
    closeCompletedSheet.addEventListener('click', closeCompletedSheetFn);
  }
  if (completedSheet) {
    completedSheet.addEventListener('click', (e) => {
      if (e.target === completedSheet) closeCompletedSheetFn();
    });
  }
  
  // Date filters for mobile
  if (mobileStartDate) {
    mobileStartDate.addEventListener('change', renderMobileCompleted);
  }
  if (mobileEndDate) {
    mobileEndDate.addEventListener('change', renderMobileCompleted);
  }

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
      closeCompletedSheetFn();
    }
  });
}

function openCompletedSheet() {
  if (completedSheet) {
    completedSheet.classList.add('active');
    renderMobileCompleted();
  }
}

function closeCompletedSheetFn() {
  if (completedSheet) {
    completedSheet.classList.remove('active');
  }
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
          await updateTask(taskId, { column: newColumn, outcome });
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
  const count = data.tasks.filter(t => t.column === columnId && (currentFilter === 'all' || t.business === currentFilter)).length;
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

// Modal functions
function openModal(task = null) {
  taskModal.classList.add('active');

  if (task) {
    modalTitle.textContent = 'Edit Task';
    document.getElementById('taskId').value = task.id;
    document.getElementById('originalColumn').value = task.column;
    document.getElementById('taskTitle').value = task.title;
    document.getElementById('taskDescription').value = task.description || '';
    document.getElementById('taskBusiness').value = task.business;
    document.getElementById('taskPriority').value = task.priority;
    document.getElementById('taskColumn').value = task.column;
  } else {
    modalTitle.textContent = 'New Task';
    taskForm.reset();
    document.getElementById('taskId').value = '';
    document.getElementById('originalColumn').value = '';
    document.getElementById('taskColumn').value = 'backlog';
  }

  document.getElementById('taskTitle').focus();
}

function closeModal() {
  taskModal.classList.remove('active');
  taskForm.reset();
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
  
  const taskData = {
    title: document.getElementById('taskTitle').value,
    description: document.getElementById('taskDescription').value,
    business: document.getElementById('taskBusiness').value,
    priority: document.getElementById('taskPriority').value,
    column: newColumn
  };

  // Check if moving to review from in-progress
  const movingToReview = newColumn === 'review' && originalColumn === 'in-progress';

  if (movingToReview) {
    closeModal();
    const existingTask = data.tasks.find(t => t.id === taskId);
    openOutcomeModal(existingTask?.outcome || '', async (outcome) => {
      taskData.outcome = outcome;
      if (taskId) {
        await updateTask(taskId, taskData);
      } else {
        await createTask(taskData);
      }
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
