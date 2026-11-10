CREATE TABLE IF NOT EXISTS reading_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    book_title  TEXT    NOT NULL CHECK (length(trim(book_title)) > 0),
    total_pages INTEGER NOT NULL CHECK (total_pages > 0),
    pages_read  INTEGER NOT NULL CHECK (pages_read > 0),
    date        TEXT    NOT NULL CHECK (date GLOB '????-??-??'),
    notes       TEXT    NOT NULL DEFAULT '',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_logs_date ON reading_logs(date);
CREATE INDEX IF NOT EXISTS idx_logs_book ON reading_logs(book_title);