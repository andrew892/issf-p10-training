<?php
class SessionModel {
    public function create(array $data, ?int $userId): int {
        $db = Database::get();
        $stmt = $db->prepare('
            INSERT INTO training_sessions
                (user_id, target_type, show_partials, confirm_mode, auto_confirm_ms, score_mode, started_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([
            $userId,
            $data['target_type'],
            (int)$data['show_partials'],
            $data['confirm_mode'],
            (int)$data['auto_confirm_ms'],
            $data['score_mode'] ?? 'point',
            $data['started_at'],
        ]);
        return (int)$db->lastInsertId();
    }

    public function startCompetition(int $id, string $startedAt): void {
        $db = Database::get();
        $db->prepare('
            UPDATE training_sessions
            SET status = \'competition\', competition_started_at = ?
            WHERE id = ?
        ')->execute([$startedAt, $id]);
    }

    public function finish(int $id, string $status, string $endedAt, bool $aborted = false): void {
        $db = Database::get();
        $db->prepare('
            UPDATE training_sessions
            SET status = ?, ended_at = ?, aborted = ?
            WHERE id = ?
        ')->execute([$status, $endedAt, (int)$aborted, $id]);
    }

    public function addShot(int $sessionId, array $shot): int {
        $db = Database::get();
        $stmt = $db->prepare('
            INSERT INTO shots
                (session_id, value, is_mouche, phase, series_number, shot_in_series,
                 shot_total, elapsed_ms, x, y)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([
            $sessionId,
            (int)$shot['value'],
            (int)($shot['is_mouche'] ?? 0),
            $shot['phase'],
            isset($shot['series_number']) ? (int)$shot['series_number'] : null,
            isset($shot['shot_in_series']) ? (int)$shot['shot_in_series'] : null,
            isset($shot['shot_total']) ? (int)$shot['shot_total'] : null,
            isset($shot['elapsed_ms']) ? (int)$shot['elapsed_ms'] : null,
            isset($shot['x']) ? (float)$shot['x'] : null,
            isset($shot['y']) ? (float)$shot['y'] : null,
        ]);
        return (int)$db->lastInsertId();
    }

    public function get(int $id, ?int $userId): ?array {
        $db = Database::get();
        $stmt = $db->prepare('SELECT * FROM training_sessions WHERE id = ?');
        $stmt->execute([$id]);
        $session = $stmt->fetch();
        if (!$session) return null;
        if ($userId !== null && $session['user_id'] !== $userId) return null;

        $shots = $db->prepare('SELECT * FROM shots WHERE session_id = ? ORDER BY id');
        $shots->execute([$id]);
        $session['shots'] = $shots->fetchAll();
        return $session;
    }

    public function listForUser(int $userId): array {
        $db = Database::get();
        $stmt = $db->prepare('
            SELECT ts.*,
                   (SELECT COUNT(*) FROM shots WHERE session_id = ts.id AND phase = \'competition\') AS shot_count,
                   (SELECT SUM(value) FROM shots WHERE session_id = ts.id AND phase = \'competition\') AS total_score
            FROM training_sessions ts
            WHERE ts.user_id = ?
            ORDER BY ts.started_at DESC
        ');
        $stmt->execute([$userId]);
        return $stmt->fetchAll();
    }

    public function delete(int $id, int $userId): bool {
        $db = Database::get();
        $stmt = $db->prepare(
            'DELETE FROM training_sessions WHERE id = ? AND user_id = ?'
        );
        $stmt->execute([$id, $userId]);
        return $stmt->rowCount() > 0;
    }
}
