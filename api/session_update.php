<?php
require_once 'helpers.php';
require_once dirname(__DIR__) . '/src/SessionModel.php';
must('POST');
$user = require_auth();
$b = body();

$id = (int)($b['session_id'] ?? 0);
if (!$id) json_err('session_id mancante');

$model = new SessionModel();
$action = $b['action'] ?? '';

if ($action === 'start_competition') {
    $model->startCompetition($id, date('Y-m-d H:i:s'));
    json_ok();
}

if ($action === 'finish') {
    $status = $b['status'] ?? 'completed';
    if (!in_array($status, ['completed', 'aborted'], true)) json_err('status non valido');
    $model->finish($id, $status, date('Y-m-d H:i:s'), $status === 'aborted');
    json_ok();
}

json_err('action non valida');
