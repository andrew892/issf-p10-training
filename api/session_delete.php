<?php
require_once 'helpers.php';
require_once dirname(__DIR__) . '/src/SessionModel.php';
must('DELETE', 'POST');
$user = require_auth();
$b = body();
$id = (int)($b['id'] ?? $_GET['id'] ?? 0);
if (!$id) json_err('id mancante');
$model = new SessionModel();
if (!$model->delete($id, $user['id'])) json_err('Sessione non trovata', 404);
json_ok();
