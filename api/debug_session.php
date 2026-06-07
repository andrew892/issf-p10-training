<?php
// RIMUOVERE dopo il debug
require_once 'helpers.php';

// Test scrittura DB
$db_write_error = null;
try {
    $db = Database::get();
    $db->exec('CREATE TABLE IF NOT EXISTS _debug_write (id INTEGER PRIMARY KEY)');
    $db->exec('DROP TABLE _debug_write');
} catch (Exception $e) {
    $db_write_error = $e->getMessage();
}

// Test sessione
$session_file = session_save_path() . '/sess_' . session_id();

header('Content-Type: application/json');
echo json_encode([
    'session_id'       => session_id(),
    'session_name'     => session_name(),
    'user_id_in_session' => $_SESSION['user_id'] ?? null,
    'session_file_exists' => file_exists($session_file),
    'db_path'          => DB_PATH,
    'db_file_exists'   => file_exists(DB_PATH),
    'db_writable'      => is_writable(DB_PATH),
    'db_write_test'    => $db_write_error ?? 'OK',
    'posix_user'       => function_exists('posix_getpwuid') ? posix_getpwuid(posix_geteuid())['name'] : 'n/a',
    'php_sapi'         => PHP_SAPI,
    'request_method'   => $_SERVER['REQUEST_METHOD'],
    'cookie_header'    => $_SERVER['HTTP_COOKIE'] ?? '(nessuno)',
], JSON_PRETTY_PRINT);
