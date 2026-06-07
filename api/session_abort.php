<?php
require_once 'helpers.php';
require_once dirname(__DIR__) . '/src/SessionModel.php';
must('POST');
$user = require_auth();
$b = body();

$sessionId = (int)($b['session_id'] ?? 0);
if (!$sessionId) json_err('session_id mancante');

$model = new SessionModel();
$db = Database::get();

// Insert remaining shots as 0
$remainingShots = $b['remaining_shots'] ?? [];
if (is_array($remainingShots)) {
    foreach ($remainingShots as $shot) {
        $model->addShot($sessionId, [
            'value'          => 0,
            'is_mouche'      => 0,
            'phase'          => 'competition',
            'series_number'  => isset($shot['seriesNumber'])  ? (int)$shot['seriesNumber']  : null,
            'shot_in_series' => isset($shot['shotInSeries']) ? (int)$shot['shotInSeries'] : null,
            'shot_total'     => isset($shot['shotTotal'])      ? (int)$shot['shotTotal']     : null,
            'elapsed_ms'     => isset($shot['elapsedMs'])      ? (int)$shot['elapsedMs']     : null,
        ]);
    }
}

$model->finish($sessionId, 'aborted', date('Y-m-d H:i:s'), true);
json_ok();
