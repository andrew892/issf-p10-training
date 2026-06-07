<?php
require_once 'helpers.php';
require_once dirname(__DIR__) . '/src/SessionModel.php';
must('POST');
$user = require_auth();
$b = body();

$sessionId = (int)($b['session_id'] ?? 0);
if (!$sessionId) json_err('session_id mancante');

$value = $b['value'] ?? null;
if ($value === null || !is_numeric($value) || (int)$value < 0 || (int)$value > 10) {
    json_err('value non valido');
}

$phase = $b['phase'] ?? '';
if (!in_array($phase, ['trial', 'competition'], true)) json_err('phase non valida');

$x = null;
if (isset($b['x'])) {
    if (!is_numeric($b['x'])) json_err('x non valido');
    $x = (float)$b['x'];
}
$y = null;
if (isset($b['y'])) {
    if (!is_numeric($b['y'])) json_err('y non valido');
    $y = (float)$b['y'];
}

$model = new SessionModel();
$shotId = $model->addShot($sessionId, [
    'value'          => (int)$value,
    'is_mouche'      => (int)(bool)($b['is_mouche'] ?? false),
    'phase'          => $phase,
    'series_number'  => isset($b['series_number'])  ? (int)$b['series_number']  : null,
    'shot_in_series' => isset($b['shot_in_series']) ? (int)$b['shot_in_series'] : null,
    'shot_total'     => isset($b['shot_total'])      ? (int)$b['shot_total']     : null,
    'elapsed_ms'     => isset($b['elapsed_ms'])      ? (int)$b['elapsed_ms']     : null,
    'x'              => $x,
    'y'              => $y,
]);

json_ok(['shot_id' => $shotId]);
