<?php
require_once 'helpers.php';
require_once dirname(__DIR__) . '/src/UserModel.php';
$admin = require_admin();
$model = new UserModel();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    json_ok($model->list());
}

if ($method === 'POST') {
    $b = body();
    $action = $b['action'] ?? 'create';

    if ($action === 'create') {
        $username = trim($b['username'] ?? '');
        $password = $b['password'] ?? '';
        if (strlen($username) < 2) json_err('Username troppo corto');
        if (strlen($password) < 4) json_err('Password troppo corta (min 4 caratteri)');
        try {
            $id = $model->create($username, $password, (bool)($b['is_admin'] ?? false));
            json_ok(['id' => $id]);
        } catch (PDOException $e) {
            $msg = str_contains($e->getMessage(), 'UNIQUE') ? 'Username già esistente' : $e->getMessage();
            json_err($msg);
        }
    }

    if ($action === 'delete') {
        $id = (int)($b['id'] ?? 0);
        if ($id === $admin['id']) json_err('Non puoi eliminare te stesso');
        $model->delete($id);
        json_ok();
    }

    if ($action === 'change_password') {
        $id = (int)($b['id'] ?? 0);
        $password = $b['password'] ?? '';
        if (strlen($password) < 4) json_err('Password troppo corta');
        $model->updatePassword($id, $password);
        json_ok();
    }
}

json_err('Metodo non consentito', 405);
