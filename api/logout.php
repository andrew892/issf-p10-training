<?php
require_once 'helpers.php';
must('POST');
$auth = new Auth();
$auth->logout();
json_ok();
