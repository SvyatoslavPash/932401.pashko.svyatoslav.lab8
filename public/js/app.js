const state = {
    logs: [],
    period: 'all',
    activeTab: 'logs'
};

const logsList       = document.getElementById('logsList');
const progressList   = document.getElementById('progressList');
const totalPagesEl   = document.getElementById('totalPages');
const calendarEl     = document.getElementById('calendar');
const logDialog      = document.getElementById('logDialog');
const logForm        = document.getElementById('logForm');
const bookInput      = document.getElementById('bookInput');
const totalPagesInput = document.getElementById('totalPagesInput');
const pagesInput     = document.getElementById('pagesInput');
const dateInput      = document.getElementById('dateInput');
const notesInput     = document.getElementById('notesInput');
const logIdInput     = document.getElementById('logId');
const dialogTitle    = document.getElementById('dialogTitle');

const todayISO = (offsetDays = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const escapeHtml = (str) => {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
};

const api = {
    async list(period) {
        let url = '/api/logs';
        if (period === 'week') url += `?from=${todayISO(-6)}&to=${todayISO(0)}`;
        else if (period === 'month') url += `?from=${todayISO(-29)}&to=${todayISO(0)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Не удалось загрузить записи');
        return res.json();
    },
    async stats(period) {
        const p = period === 'week' ? 'week' : 'month';
        const res = await fetch(`/api/logs/stats?period=${p}`);
        if (!res.ok) throw new Error('Не удалось загрузить статистику');
        return res.json();
    },
    async create(data) {
        const res = await fetch('/api/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return handleResponse(res);
    },
    async update(id, data) {
        const res = await fetch(`/api/logs/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return handleResponse(res);
    },
    async remove(id) {
        const res = await fetch(`/api/logs/${id}`, { method: 'DELETE' });
        return handleResponse(res);
    }
};

async function handleResponse(res) {
    if (res.ok) return res.json();
    let message = 'Ошибка запроса';
    try {
        const data = await res.json();
        if (data.errors) message = data.errors.join('\n');
        else if (data.error) message = data.error;
    } catch { /* ignore */ }
    throw new Error(message);
}

function renderLogs() {
    if (!state.logs.length) {
        logsList.innerHTML = '<p class="log-meta">Записей пока нет.</p>';
        return;
    }
    logsList.innerHTML = state.logs.map(log => `
        <article class="log-card" data-id="${log.id}">
            <div>
                <h3>${escapeHtml(log.book_title)}</h3>
                <p class="log-meta">${log.date} · ${log.pages_read} стр. из ${log.total_pages}</p>
                ${log.notes ? `<p>${escapeHtml(log.notes)}</p>` : ''}
            </div>
            <div class="log-actions">
                <button class="btn edit-btn" data-id="${log.id}" type="button" aria-label="Редактировать">✏️</button>
                <button class="btn delete-btn" data-id="${log.id}" type="button" aria-label="Удалить">🗑️</button>
            </div>
        </article>
    `).join('');
}

function renderStats(data) {
    totalPagesEl.textContent = data.total_pages;

    progressList.innerHTML = data.progress.length
        ? data.progress.map(book => {
            const percent = Math.min(100, Math.round((book.pages_read / book.total_pages) * 100));
            return `
                <div class="progress-item">
                    <div class="progress-header">
                        <span>${escapeHtml(book.book_title)}</span>
                        <span>${book.pages_read} / ${book.total_pages} стр. (${percent}%)</span>
                    </div>
                    <progress value="${book.pages_read}" max="${book.total_pages}"
                              aria-label="Прогресс по книге ${escapeHtml(book.book_title)}"></progress>
                </div>
            `;
        }).join('')
        : '<p class="log-meta">Пока нет данных.</p>';

    renderCalendar(data.period_logs || []);
}

function renderCalendar(periodLogs) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay(); // 0 — вс

    const loggedDates = new Set(periodLogs.map(l => l.date));
    const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    let html = weekDays.map(d => `<div class="weekday">${d}</div>`).join('');

    const offset = firstDay === 0 ? 6 : firstDay - 1;
    for (let i = 0; i < offset; i++) html += '<div class="day empty"></div>';

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const hasLog = loggedDates.has(dateStr);
        html += `<div class="day ${hasLog ? 'has-log' : ''}" title="${dateStr}">${d}</div>`;
    }

    calendarEl.innerHTML = html;
}

function openDialog(log = null) {
    logForm.reset();
    if (log) {
        dialogTitle.textContent = 'Редактировать запись';
        logIdInput.value = log.id;
        bookInput.value = log.book_title;
        totalPagesInput.value = log.total_pages;
        pagesInput.value = log.pages_read;
        dateInput.value = log.date;
        notesInput.value = log.notes || '';
    } else {
        dialogTitle.textContent = 'Новая запись';
        logIdInput.value = '';
        dateInput.value = todayISO();
        totalPagesInput.value = 300;
    }
    logDialog.showModal();
}

async function loadLogs() {
    state.logs = await api.list(state.period);
    renderLogs();
}

async function loadStats() {
    const data = await api.stats(state.period === 'all' ? 'month' : state.period);
    renderStats(data);
}

document.getElementById('addBtn').addEventListener('click', () => openDialog());
document.getElementById('cancelBtn').addEventListener('click', () => logDialog.close());

logForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const pages = Number(pagesInput.value);
    if (!Number.isInteger(pages) || pages <= 0) {
        alert('Страницы должны быть больше 0');
        return;
    }
    const total = Number(totalPagesInput.value);
    if (!Number.isInteger(total) || total <= 0) {
        alert('Всего страниц должно быть больше 0');
        return;
    }
    if (!bookInput.value.trim()) {
        alert('Введите название книги');
        return;
    }

    const payload = {
        book_title: bookInput.value.trim(),
        total_pages: total,
        pages_read: pages,
        date: dateInput.value,
        notes: notesInput.value.trim()
    };

    try {
        const id = logIdInput.value;
        if (id) await api.update(id, payload);
        else await api.create(payload);

        logDialog.close();
        await Promise.all([loadLogs(), loadStats()]);
    } catch (err) {
        alert(err.message);
    }
});

logsList.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.edit-btn');
    const deleteBtn = e.target.closest('.delete-btn');

    if (editBtn) {
        const log = state.logs.find(l => l.id == editBtn.dataset.id);
        if (log) openDialog(log);
        return;
    }
    if (deleteBtn) {
        if (!confirm('Удалить запись?')) return;
        try {
            await api.remove(deleteBtn.dataset.id);
            await Promise.all([loadLogs(), loadStats()]);
        } catch (err) {
            alert(err.message);
        }
    }
});

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.tab;
        document.getElementById(target === 'logs' ? 'logsTab' : 'statsTab').classList.add('active');
        state.activeTab = target;
        if (target === 'stats') loadStats();
    });
});

document.getElementById('periodSelect').addEventListener('change', async (e) => {
    state.period = e.target.value;
    try {
        await Promise.all([loadLogs(), loadStats()]);
    } catch (err) {
        alert(err.message);
    }
});

(async function init() {
    try {
        await Promise.all([loadLogs(), loadStats()]);
    } catch (err) {
        logsList.innerHTML = `<p class="log-meta">${escapeHtml(err.message)}</p>`;
    }
})();