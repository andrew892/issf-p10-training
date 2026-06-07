<?php
class UserModel {
    public function list(): array {
        $db = Database::get();
        return $db->query(
            'SELECT id, username, is_admin, created_at FROM users ORDER BY created_at'
        )->fetchAll();
    }

    public function create(string $username, string $password, bool $isAdmin = false): int {
        $db = Database::get();
        $stmt = $db->prepare(
            'INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)'
        );
        $stmt->execute([$username, password_hash($password, PASSWORD_DEFAULT), (int)$isAdmin]);
        return (int)$db->lastInsertId();
    }

    public function delete(int $id): void {
        $db = Database::get();
        $db->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
    }

    public function updatePassword(int $id, string $password): void {
        $db = Database::get();
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $db->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([$hash, $id]);
    }
}
