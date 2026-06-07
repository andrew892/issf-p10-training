<?php
require_once 'helpers.php';
require_once dirname(__DIR__) . '/src/UserModel.php';
must('POST');
$user = require_auth();
$b = body();

$current = $b['current_password'] ?? '';
$new     = $b['new_password'] ?? '';

if (strlen($new) < 4) {
    json_err('La nuova password deve essere di almeno 4 caratteri');
}

$db   = Database::get();
$stmt = $db->prepare('SELECT password_hash FROM users WHERE id = ?');
$stmt->execute([$user['id']]);
$row  = $stmt->fetch();

if (!$row || !password_verify($current, $row['password_hash'])) {
    json_err('Password corrente non corretta');
}

(new UserModel())->updatePassword((int)$user['id'], $new);
json_ok();
