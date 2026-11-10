const express = require('express');
const db = require('../db');

const router = express.Router();

function validateLog(data) {
    const errors = [];
    if (!data.book_title || !String(data.book_title).trim()) {
        errors.push('Название книги обязательно');
    } else if (String(data.book_title).length > 255) {
        errors.push('Название книги слишком длинное');
    }
    if (!Number.isInteger(Number(data.total_pages)) || Number(data.total_pages) <= 0) {
        errors.push('Всего страниц должно быть положительным целым числом');
    }
    if (!Number.isInteger(Number(data.pages_read)) || Number(data.pages_read) <= 0) {
        errors.push('Прочитано страниц должно быть больше 0');
    }
    if (!data.date || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
        errors.push('Некорректная дата (ожидается YYYY-MM-DD)');
    }
    if (data.notes && String(data.notes).length > 1000) {
        errors.push('Заметки слишком длинные (макс. 1000 символов)');
    }
    return errors;
}

function todayISO(offsetDays = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

router.get('/', (req, res) => {
    const { from, to } = req.query;
    let sql = 'SELECT * FROM reading_logs';
    const params = [];

    if (from && to) {
        sql += ' WHERE date BETWEEN ? AND ?';
        params.push(from, to);
    }
    sql += ' ORDER BY date DESC, id DESC';

    const rows = db.prepare(sql).all(...params);
    res.json(rows);
});

router.get('/stats', (req, res) => {
    const period = req.query.period === 'week' ? 7 : 30;
    const from = todayISO(-(period - 1));
    const to = todayISO(0);

    const total = db.prepare(
        'SELECT COALESCE(SUM(pages_read), 0) AS total FROM reading_logs WHERE date BETWEEN ? AND ?'
    ).get(from, to);

    const progress = db.prepare(`
        SELECT book_title,
               MAX(total_pages) AS total_pages,
               SUM(pages_read)  AS pages_read
        FROM reading_logs
        GROUP BY book_title
        ORDER BY book_title
    `).all();

    const periodLogs = db.prepare(
        'SELECT date, SUM(pages_read) AS pages FROM reading_logs WHERE date BETWEEN ? AND ? GROUP BY date'
    ).all(from, to);

    res.json({
        period: { from, to },
        total_pages: total.total,
        progress,
        period_logs: periodLogs
    });
});

router.get('/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM reading_logs WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Запись не найдена' });
    res.json(row);
});

router.post('/', (req, res) => {
    const errors = validateLog(req.body);
    if (errors.length) return res.status(422).json({ errors });

    const info = db.prepare(`
        INSERT INTO reading_logs (book_title, total_pages, pages_read, date, notes)
        VALUES (?, ?, ?, ?, ?)
    `).run(
        String(req.body.book_title).trim(),
        Number(req.body.total_pages),
        Number(req.body.pages_read),
        req.body.date,
        req.body.notes || ''
    );

    const created = db.prepare('SELECT * FROM reading_logs WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(created);
});

router.put('/:id', (req, res) => {
    const exists = db.prepare('SELECT id FROM reading_logs WHERE id = ?').get(req.params.id);
    if (!exists) return res.status(404).json({ error: 'Запись не найдена' });

    const errors = validateLog(req.body);
    if (errors.length) return res.status(422).json({ errors });

    db.prepare(`
        UPDATE reading_logs
        SET book_title = ?, total_pages = ?, pages_read = ?, date = ?, notes = ?
        WHERE id = ?
    `).run(
        String(req.body.book_title).trim(),
        Number(req.body.total_pages),
        Number(req.body.pages_read),
        req.body.date,
        req.body.notes || '',
        req.params.id
    );

    const updated = db.prepare('SELECT * FROM reading_logs WHERE id = ?').get(req.params.id);
    res.json(updated);
});

router.delete('/:id', (req, res) => {
    const info = db.prepare('DELETE FROM reading_logs WHERE id = ?').run(req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: 'Запись не найдена' });
    res.json({ ok: true });
});

module.exports = router;