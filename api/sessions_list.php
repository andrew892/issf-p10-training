<?php
require_once 'helpers.php';
require_once dirname(__DIR__) . '/src/SessionModel.php';
must('GET');
$user = require_auth();
$model = new SessionModel();
json_ok($model->listForUser($user['id']));
