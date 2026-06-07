<?php
class Auth {
    public function login(string $username, string $password): ?array {
        $db = Database::get();
        $stmt = $db->prepare('SELECT * FROM users WHERE username = ?');
        $stmt->execute([$username]);
        $user = $stmt->fetch();
        if (!$user || !password_verify($password, $user['password_hash'])) {
            return null;
        }
        $_SESSION['user_id'] = $user['id'];
        return $user;
    }

    public function logout(): void {
        $_SESSION = [];
        session_destroy();
    }

    public function currentUser(): ?array {
        if (empty($_SESSION['user_id'])) {
            return null;
        }
        $db = Database::get();
        $stmt = $db->prepare('SELECT id, username, is_admin FROM users WHERE id = ?');
        $stmt->execute([$_SESSION['user_id']]);
        return $stmt->fetch() ?: null;
    }
}
