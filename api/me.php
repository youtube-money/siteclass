<?php
require_once __DIR__ . '/session-helper.php';

$me = requireLogin();
jsonResponse(['user' => $me]);
