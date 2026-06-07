<?php
require_once dirname(__DIR__) . '/config.php';
require_once dirname(__DIR__) . '/src/Database.php';
require_once dirname(__DIR__) . '/src/Auth.php';

ini_set('session.cookie_samesite', 'Lax');
session_name(SESSION_NAME);
session_start();

function json_ok(mixed $data = null): never {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => true, 'data' => $data]);
    exit;
}

function json_err(string $msg, int $status = 400): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
}

function require_auth(): array {
    $auth = new Auth();
    $user = $auth->currentUser();
    if (!$user) {
        json_err('Non autenticato', 401);
    }
    return $user;
}

function require_admin(): array {
    $user = require_auth();
    if (!$user['is_admin']) {
        json_err('Accesso negato', 403);
    }
    return $user;
}

function body(): array {
    static $parsed = null;
    if ($parsed === null) {
        $raw = file_get_contents('php://input');
        $parsed = json_decode($raw, true) ?? [];
    }
    return $parsed;
}

function must(string ...$methods): void {
    if (!in_array($_SERVER['REQUEST_METHOD'], $methods, true)) {
        json_err('Metodo non consentito', 405);
    }
}
