<?php
require_once 'helpers.php';
require_once dirname(__DIR__) . '/src/SessionModel.php';
must('GET');
$user = require_auth();
$id = (int)($_GET['id'] ?? 0);
if (!$id) json_err('id mancante');
$model = new SessionModel();
$session = $model->get($id, $user['id']);
if (!$session) json_err('Sessione non trovata', 404);
json_ok($session);
