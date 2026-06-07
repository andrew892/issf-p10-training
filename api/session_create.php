<?php
require_once 'helpers.php';
require_once dirname(__DIR__) . '/src/SessionModel.php';
must('POST');
$user = require_auth();
$b = body();

$allowed = ['paper', 'electronic'];
if (!in_array($b['target_type'] ?? '', $allowed, true)) {
    json_err('target_type non valido');
}

$model = new SessionModel();
$id = $model->create([
    'target_type'     => $b['target_type'],
    'show_partials'   => (bool)($b['show_partials'] ?? true),
    'confirm_mode'    => in_array($b['confirm_mode'] ?? 'manual', ['manual','auto'], true)
                         ? $b['confirm_mode'] : 'manual',
    'auto_confirm_ms' => max(500, min(10000, (int)($b['auto_confirm_ms'] ?? 3000))),
    'score_mode'      => in_array($b['score_mode'] ?? 'point', ['point','group'], true)
                         ? $b['score_mode'] : 'point',
    'started_at'      => date('Y-m-d H:i:s'),
], $user['id']);

json_ok(['session_id' => $id]);
