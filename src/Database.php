<?php
class Database {
    private static ?PDO $pdo = null;

    public static function get(): PDO {
        if (self::$pdo === null) {
            $dir = dirname(DB_PATH);
            if (!is_dir($dir)) {
                mkdir($dir, 0750, true);
            }
            self::$pdo = new PDO('sqlite:' . DB_PATH);
            self::$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            self::$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
            self::$pdo->exec('PRAGMA journal_mode=WAL');
            self::$pdo->exec('PRAGMA foreign_keys=ON');
            self::initSchema(self::$pdo);
        }
        return self::$pdo;
    }

    private static function initSchema(PDO $db): void {
        $db->exec("
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                is_admin INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS training_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                target_type TEXT NOT NULL CHECK(target_type IN ('paper','electronic')),
                show_partials INTEGER DEFAULT 1,
                confirm_mode TEXT DEFAULT 'manual' CHECK(confirm_mode IN ('manual','auto')),
                auto_confirm_ms INTEGER DEFAULT 3000,
                score_mode TEXT DEFAULT 'point' CHECK(score_mode IN ('point','group')),
                started_at DATETIME NOT NULL,
                competition_started_at DATETIME,
                ended_at DATETIME,
                status TEXT DEFAULT 'trial'
                    CHECK(status IN ('trial','competition','completed','aborted')),
                aborted INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS shots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL
                    REFERENCES training_sessions(id) ON DELETE CASCADE,
                value INTEGER NOT NULL CHECK(value BETWEEN 0 AND 10),
                is_mouche INTEGER DEFAULT 0,
                phase TEXT NOT NULL CHECK(phase IN ('trial','competition')),
                series_number INTEGER,
                shot_in_series INTEGER,
                shot_total INTEGER,
                elapsed_ms INTEGER,
                x REAL,
                y REAL,
                recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        ");

        // Migrazione: aggiunge colonne mancanti ai DB creati da versioni precedenti
        // (CREATE TABLE IF NOT EXISTS non altera tabelle già esistenti).
        self::ensureColumn($db, 'training_sessions', 'score_mode', "TEXT DEFAULT 'point'");
        self::ensureColumn($db, 'shots', 'x', 'REAL');
        self::ensureColumn($db, 'shots', 'y', 'REAL');

        // Seed admin user if DB is empty
        $count = (int) $db->query('SELECT COUNT(*) FROM users')->fetchColumn();
        if ($count === 0) {
            $hash = password_hash('admin', PASSWORD_DEFAULT);
            $stmt = $db->prepare(
                'INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)'
            );
            $stmt->execute(['admin', $hash]);
        }
    }

    private static function ensureColumn(PDO $db, string $table, string $column, string $definition): void {
        $cols = $db->query("PRAGMA table_info({$table})")->fetchAll(PDO::FETCH_COLUMN, 1);
        if (!in_array($column, $cols, true)) {
            $db->exec("ALTER TABLE {$table} ADD COLUMN {$column} {$definition}");
        }
    }
}
