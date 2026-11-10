const db = require('../db');

const count = db.prepare('SELECT COUNT(*) AS c FROM reading_logs').get().c;
if (count > 0) {
    console.log(`База уже содержит ${count} записей. Сидинг пропущен.`);
    process.exit(0);
}

function dateAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
}

const insert = db.prepare(`
    INSERT INTO reading_logs (book_title, total_pages, pages_read, date, notes)
    VALUES (?, ?, ?, ?, ?)
`);

const seed = db.transaction(() => {
    insert.run('Чистый код', 464, 30, dateAgo(1), 'Глава 1–2');
    insert.run('Чистый код', 464, 25, dateAgo(0), 'Глава 3');
    insert.run('Гарри Поттер и философский камень', 332, 50, dateAgo(3), 'Первые главы');
    insert.run('Дюна', 688, 40, dateAgo(6), 'Начало');
    insert.run('Дюна', 688, 60, dateAgo(2), '');
});

seed();
console.log('Тестовые данные добавлены.');