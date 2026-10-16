const API = 'https://spendsmart-api-pypj.onrender.com/api';
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const categories = [
  'Food',
  'Transport',
  'Shopping',
  'Bills',
  'Entertainment',
  'Health',
  'Education',
  'Salary',
  'Freelance',
  'Investment',
  'Other'
];

let transactions = [];
let currentUser = null;
let authMode = 'login';
let cashflowChart = null;
let categoryChart = null;
let budgetData = null;
let toastTimer;

const currentMonth = () => new Date().toISOString().slice(0, 7);
const today = () => new Date().toISOString().slice(0, 10);

const money = value =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(Number(value) || 0);

const esc = value =>
  String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);

function message(text, type = 'error') {
  const el = $('#toast');

  el.textContent = text;
  el.className = `toast show ${type}`;

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    el.className = 'toast';
  }, 3200);
}

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status}).`);
  }

  return data;
}

function setAuthMode(mode) {
  authMode = mode;

  const registering = mode === 'register';

  $('#nameField').classList.toggle('hidden', !registering);
  $('#authName').required = registering;

  $('#authEyebrow').textContent = registering
    ? 'GET STARTED'
    : 'WELCOME BACK';

  $('#authTitle').textContent = registering
    ? 'Create your account'
    : 'Log in to your account';

  $('#authSubtitle').textContent = registering
    ? 'Start building better money habits.'
    : 'Pick up where you left off.';

  $('#authSubmit').innerHTML = registering
    ? 'Create account <span>→</span>'
    : 'Log in <span>→</span>';

  $('#switchText').textContent = registering
    ? 'Already have an account?'
    : 'New to SpendSmart?';

  $('#switchAuth').textContent = registering
    ? 'Log in'
    : 'Create an account';

  $('#authPassword').autocomplete = registering
    ? 'new-password'
    : 'current-password';

  $('#passwordHint').classList.toggle('hidden', !registering);
}

function showAuth() {
  $('#authView').classList.remove('hidden');
  $('#appView').classList.add('hidden');
}

function showApp() {
  $('#authView').classList.add('hidden');
  $('#appView').classList.remove('hidden');

  const name = currentUser?.name || 'there';

  $('#welcomeName').textContent = name.split(' ')[0];
  $('#sidebarName').textContent = name;
  $('#sidebarEmail').textContent = currentUser?.email || '';
  $('#avatar').textContent = name.charAt(0).toUpperCase();
}

async function onAuthSubmit(event) {
  event.preventDefault();

  const email = $('#authEmail').value.trim();
  const password = $('#authPassword').value;

  const payload = { email, password };

  if (authMode === 'register') {
    payload.name = $('#authName').value.trim();
  }

  try {
    const data = await api(`/auth/${authMode}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    currentUser = data.user;

    message(data.message || 'Success!', 'success');

    $('#authForm').reset();

    await loadSession();
  } catch (error) {
    message(error.message);
  }
}

async function loadSession() {
  try {
    const data = await api('/auth/me');

    currentUser = data.user;

    showApp();

    await loadTransactions();
    await renderDashboard();
    await loadBudget();
  } catch {
    currentUser = null;
    transactions = [];

    showAuth();
  }
}

async function logout() {
  try {
    await api('/auth/logout', {
      method: 'POST'
    });

    currentUser = null;
    transactions = [];

    showAuth();

    message('Logged out successfully.', 'success');
  } catch (error) {
    message(error.message);
  }
}

async function loadTransactions() {
  transactions = await api('/transactions');

  renderTransactionTable();
  renderRecent();
}

function monthTransactions(month) {
  return transactions.filter(
    t => String(t.date).slice(0, 7) === month
  );
}

function totals(items, type) {
  return items
    .filter(t => t.type === type)
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
}

async function renderDashboard() {
  const month = $('#dashboardMonth').value || currentMonth();
  const selected = monthTransactions(month);

  $('#balanceValue').textContent = money(
    totals(transactions, 'income') -
    totals(transactions, 'expense')
  );

  $('#incomeValue').textContent = money(
    totals(selected, 'income')
  );

  $('#expenseValue').textContent = money(
    totals(selected, 'expense')
  );

  $('#savingsValue').textContent = money(
    totals(selected, 'income') -
    totals(selected, 'expense')
  );

  $('#todayLabel').textContent = new Date().toLocaleDateString(
    'en-IN',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }
  );

  drawCashflow(selected, month);
  drawCategories(selected);
}

function drawCashflow(items, month) {
  const canvas = $('#cashflowChart');

  if (!canvas || typeof Chart === 'undefined') return;

  if (cashflowChart) {
    cashflowChart.destroy();
  }

  const [year, mon] = month.split('-').map(Number);

  const days = new Date(year, mon, 0).getDate();

  const labels = Array.from(
    { length: days },
    (_, i) => String(i + 1)
  );

  const income = Array(days).fill(0);
  const expenses = Array(days).fill(0);

  items.forEach(t => {
    const day = Number(String(t.date).slice(8, 10)) - 1;

    if (day >= 0 && day < days) {
      (t.type === 'income' ? income : expenses)[day] +=
        Number(t.amount);
    }
  });

  cashflowChart = new Chart(canvas, {
    type: 'line',

    data: {
      labels,

      datasets: [
        {
          label: 'Income',
          data: income,
          borderColor: '#20b981',
          backgroundColor: '#20b98120',
          fill: true,
          tension: 0.35,
          pointRadius: 1
        },
        {
          label: 'Expenses',
          data: expenses,
          borderColor: '#ed8277',
          backgroundColor: '#ed827720',
          fill: true,
          tension: 0.35,
          pointRadius: 1
        }
      ]
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,

      interaction: {
        mode: 'index',
        intersect: false
      },

      plugins: {
        legend: {
          position: 'bottom',

          labels: {
            usePointStyle: true,
            boxWidth: 7,
            font: {
              size: 10
            }
          }
        }
      },

      scales: {
        x: {
          grid: {
            display: false
          },

          ticks: {
            maxTicksLimit: 8,
            font: {
              size: 9
            }
          }
        },

        y: {
          beginAtZero: true,

          ticks: {
            font: {
              size: 9
            },

            callback: v =>
              new Intl.NumberFormat('en-IN', {
                notation: 'compact'
              }).format(v)
          }
        }
      }
    }
  });
}

function drawCategories(items) {
  const totalsByCategory = {};

  items
    .filter(t => t.type === 'expense')
    .forEach(t => {
      totalsByCategory[t.category] =
        (totalsByCategory[t.category] || 0) +
        Number(t.amount);
    });

  const labels = Object.keys(totalsByCategory);
  const values = Object.values(totalsByCategory);
  const canvas = $('#categoryChart');

  const colors = [
    '#20b981',
    '#796be8',
    '#f0ad5e',
    '#ed8277',
    '#56a8d8',
    '#d879ad',
    '#8b9aab',
    '#57c7bc',
    '#b7a1ef',
    '#f3cf64',
    '#a3b9d3'
  ];

  if (canvas && typeof Chart !== 'undefined') {
    if (categoryChart) {
      categoryChart.destroy();
    }

    categoryChart = new Chart(canvas, {
      type: 'doughnut',

      data: {
        labels,

        datasets: [
          {
            data: values,
            backgroundColor: colors,
            borderWidth: 3,
            borderColor: '#fff'
          }
        ]
      },

      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',

        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  }

  $('#categoryLegend').innerHTML = labels.length
    ? labels.map((label, i) =>
        `<span class="legend-item"><i class="legend-dot" style="background:${colors[i % 11]}"></i>${esc(label)}</span>`
      ).join('')
    : '<span>No expenses to show yet.</span>';
}

function renderRecent() {
  const items = [...transactions]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 5);

  $('#recentRows').innerHTML = items.map(t =>
    `<tr>
      <td>${esc(t.description)}</td>
      <td><span class="category-chip">${esc(t.category)}</span></td>
      <td>${esc(t.date)}</td>
      <td class="${t.type === 'income' ? 'amount-income' : 'amount-expense'}">${t.type === 'income' ? '+' : '−'}${money(t.amount)}</td>
    </tr>`
  ).join('');

  $('#recentEmpty').classList.toggle(
    'hidden',
    items.length > 0
  );
}

function filteredTransactions() {
  const search = $('#searchTransactions').value.trim().toLowerCase();
  const type = $('#filterType').value;
  const category = $('#filterCategory').value;
  const month = $('#filterMonth').value;

  return [...transactions]
    .filter(t =>
      (
        !search ||
        t.description.toLowerCase().includes(search) ||
        (t.notes || '').toLowerCase().includes(search)
      ) &&
      (type === 'all' || t.type === type) &&
      (category === 'all' || t.category === category) &&
      (!month || t.date.startsWith(month))
    )
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function renderTransactionTable() {
  if (!$('#transactionRows')) return;

  const items = filteredTransactions();

  $('#transactionRows').innerHTML = items.map(t =>
    `<tr>
      <td>${esc(t.description)}${t.notes ? `<br><small>${esc(t.notes)}</small>` : ''}</td>
      <td><span class="category-chip">${esc(t.category)}</span></td>
      <td>${esc(t.date)}</td>
      <td><span class="type-chip ${t.type}">${t.type}</span></td>
      <td class="${t.type === 'income' ? 'amount-income' : 'amount-expense'}">${t.type === 'income' ? '+' : '−'}${money(t.amount)}</td>
      <td>
        <button class="table-action" data-edit="${esc(t._id)}">Edit</button>
        <button class="table-action delete" data-delete="${esc(t._id)}">Delete</button>
      </td>
    </tr>`
  ).join('');

  $('#transactionsEmpty').classList.toggle(
    'hidden',
    items.length > 0
  );
}

function openModal(transaction = null) {
  $('#transactionForm').reset();

  $('#transactionId').value = transaction?._id || '';

  $('#modalTitle').textContent = transaction
    ? 'Edit transaction'
    : 'Add transaction';

  $('#saveTransaction').textContent = transaction
    ? 'Update transaction →'
    : 'Save transaction →';

  $('#description').value = transaction?.description || '';
  $('#amount').value = transaction?.amount ?? '';
  $('#category').value = transaction?.category || 'Food';
  $('#transactionDate').value = transaction?.date || today();
  $('#notes').value = transaction?.notes || '';

  const radio = $(
    `input[name="transactionType"][value="${transaction?.type || 'expense'}"]`
  );

  if (radio) {
    radio.checked = true;
  }

  $('#transactionModal').classList.remove('hidden');

  $('#description').focus();
}

function closeModal() {
  $('#transactionModal').classList.add('hidden');
}

async function saveTransaction(event) {
  event.preventDefault();

  const id = $('#transactionId').value;

  const payload = {
    description: $('#description').value.trim(),
    amount: Number($('#amount').value),
    category: $('#category').value,
    type: $('input[name="transactionType"]:checked').value,
    date: $('#transactionDate').value,
    notes: $('#notes').value.trim()
  };

  try {
    await api(
      id
        ? `/transactions/${encodeURIComponent(id)}`
        : '/transactions',
      {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      }
    );

    closeModal();

    await loadTransactions();
    await renderDashboard();
    await loadBudget();

    message(
      id
        ? 'Transaction updated.'
        : 'Transaction added successfully.',
      'success'
    );
  } catch (error) {
    message(error.message);
  }
}

async function deleteTransaction(id) {
  if (!confirm('Delete this transaction?')) return;

  try {
    await api(`/transactions/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });

    await loadTransactions();
    await renderDashboard();
    await loadBudget();

    message('Transaction deleted.', 'success');
  } catch (error) {
    message(error.message);
  }
}

function setPage(page) {
  const pages = {
    overview: '#overviewPage',
    transactions: '#transactionsPage',
    budgets: '#budgetsPage'
  };

  Object.entries(pages).forEach(([key, selector]) => {
    $(selector).classList.toggle('hidden', key !== page);
  });

  $$('[data-page]').forEach(button => {
    button.classList.toggle(
      'active',
      button.dataset.page === page
    );
  });

  $('#pageTitle').textContent =
    page === 'overview'
      ? 'Overview'
      : page === 'transactions'
        ? 'Transactions'
        : 'Budgets';

  $('#sidebar').classList.remove('open');

  if (page === 'transactions') {
    renderTransactionTable();
  }

  if (page === 'budgets') {
    loadBudget();
  }
}

async function loadBudget() {
  const month = $('#budgetMonth').value || currentMonth();

  try {
    budgetData = await api(`/budgets/${month}`);

    const b = budgetData;

    $('#budgetMonthText').textContent =
      new Date(`${month}-02T00:00:00`).toLocaleDateString(
        'en-IN',
        {
          month: 'long',
          year: 'numeric'
        }
      );

    $('#budgetAmount').value = b.amount || '';
    $('#budgetSpent').textContent = money(b.spent);
    $('#budgetIncome').textContent = money(b.income);
    $('#budgetCount').textContent = b.expenseCount;

    const remaining = Number(b.amount) - Number(b.spent);

    $('#budgetRemaining').textContent = b.amount
      ? money(remaining)
      : '—';

    const percent = b.amount
      ? Math.round(Number(b.spent) / Number(b.amount) * 100)
      : 0;

    $('#budgetProgress').style.width =
      `${Math.min(percent, 100)}%`;

    $('#budgetStatus').textContent =
      !b.amount
        ? 'NOT SET'
        : percent >= 100
          ? 'LIMIT REACHED'
          : percent >= 80
            ? 'NEAR LIMIT'
            : 'ON TRACK';

    $('#budgetPercent').textContent = b.amount
      ? `${percent}% of budget used`
      : 'Set a budget to start tracking';

    $('#budgetLimitText').textContent = b.amount
      ? `Limit ${money(b.amount)}`
      : '';

    $('#budgetAdvice p').textContent =
      !b.amount
        ? 'Set a monthly budget to get a clearer picture of your spending.'
        : percent >= 100
          ? 'You have reached or passed your planned spending limit. Review this month’s expenses.'
          : percent >= 80
            ? 'You are getting close to your budget. Check your recent spending.'
            : 'You are within your planned spending limit. Keep it up!';
  } catch (error) {
    message(error.message);
  }
}

async function saveBudget(event) {
  event.preventDefault();

  const month = $('#budgetMonth').value || currentMonth();
  const amount = Number($('#budgetAmount').value);

  try {
    await api(`/budgets/${month}`, {
      method: 'PUT',
      body: JSON.stringify({ amount })
    });

    await loadBudget();

    message('Monthly budget saved.', 'success');
  } catch (error) {
    message(error.message);
  }
}

async function removeBudget() {
  const month = $('#budgetMonth').value || currentMonth();

  if (!confirm('Remove the budget for this month?')) return;

  try {
    await api(`/budgets/${month}`, {
      method: 'DELETE'
    });

    await loadBudget();

    message('Budget removed.', 'success');
  } catch (error) {
    message(error.message);
  }
}

function exportCSV() {
  const rows = filteredTransactions();

  if (!rows.length) {
    return message('There are no transactions to export.');
  }

  const cell = value =>
    `"${String(value ?? '').replace(/"/g, '""')}"`;

  const csv = [
    ['Description', 'Category', 'Date', 'Type', 'Amount', 'Notes'],
    ...rows.map(t => [
      t.description,
      t.category,
      t.date,
      t.type,
      t.amount,
      t.notes || ''
    ])
  ]
    .map(row => row.map(cell).join(','))
    .join('\r\n');

  const url = URL.createObjectURL(
    new Blob(['\uFEFF' + csv], {
      type: 'text/csv;charset=utf-8;'
    })
  );

  const link = document.createElement('a');

  link.href = url;
  link.download = 'spendsmart-transactions.csv';
  link.click();

  URL.revokeObjectURL(url);
}

document.addEventListener('DOMContentLoaded', () => {
  $('#authForm').addEventListener('submit', onAuthSubmit);

  $('#switchAuth').addEventListener('click', () => {
    setAuthMode(authMode === 'login' ? 'register' : 'login');
  });

  $('#logoutBtn').addEventListener('click', logout);

  $('#topAddBtn').addEventListener('click', () => openModal());

  $$('[data-open-modal]').forEach(button => {
    button.addEventListener('click', () => openModal());
  });

  $('#closeModal').addEventListener('click', closeModal);
  $('#cancelModal').addEventListener('click', closeModal);

  $('#transactionForm').addEventListener('submit', saveTransaction);

  $('#transactionModal').addEventListener('click', event => {
    if (event.target === $('#transactionModal')) {
      closeModal();
    }
  });

  $$('[data-page]').forEach(button => {
    button.addEventListener('click', () => {
      setPage(button.dataset.page);
    });
  });

  $$('[data-go]').forEach(button => {
    button.addEventListener('click', () => {
      setPage(button.dataset.go);
    });
  });

  $('#menuBtn').addEventListener('click', () => {
    $('#sidebar').classList.toggle('open');
  });

  [
    'searchTransactions',
    'filterType',
    'filterCategory',
    'filterMonth'
  ].forEach(id => {
    $('#' + id).addEventListener(
      id === 'searchTransactions' ? 'input' : 'change',
      renderTransactionTable
    );
  });

  $('#clearFilters').addEventListener('click', () => {
    $('#searchTransactions').value = '';
    $('#filterType').value = 'all';
    $('#filterCategory').value = 'all';
    $('#filterMonth').value = '';

    renderTransactionTable();
  });

  $('#exportBtn').addEventListener('click', exportCSV);

  $('#transactionRows').addEventListener('click', event => {
    const edit = event.target.closest('[data-edit]');
    const del = event.target.closest('[data-delete]');

    if (edit) {
      const transaction = transactions.find(
        item => item._id === edit.dataset.edit
      );

      if (transaction) {
        openModal(transaction);
      }
    }

    if (del) {
      deleteTransaction(del.dataset.delete);
    }
  });

  $('#dashboardMonth').value = currentMonth();

  $('#dashboardMonth').addEventListener(
    'change',
    renderDashboard
  );

  $('#budgetMonth').value = currentMonth();

  $('#budgetMonth').addEventListener(
    'change',
    loadBudget
  );

  $('#budgetForm').addEventListener('submit', saveBudget);

  $('#removeBudgetBtn').addEventListener(
    'click',
    removeBudget
  );

  $('#yearLabel').textContent = new Date().getFullYear();

  setAuthMode('login');

  $('#transactionDate').value = today();

  loadSession();
});
