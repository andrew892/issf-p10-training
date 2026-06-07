<?php
require_once 'helpers.php';
must('POST');
$b = body();
if (empty($b['username']) || empty($b['password'])) {
    json_err('Username e password obbligatori');
}
$auth = new Auth();
$user = $auth->login(trim($b['username']), $b['password']);
if (!$user) {
    json_err('Credenziali non valide', 401);
}
json_ok([
    'id'       => $user['id'],
    'username' => $user['username'],
    'is_admin' => (bool)$user['is_admin'],
]);
