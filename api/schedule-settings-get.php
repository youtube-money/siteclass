<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

requireLogin();

$pdo = getDB();
$row = $pdo->query("SELECT setting_value FROM site_settings WHERE setting_key = 'lessons_per_day'")->fetch();

jsonResponse(['lessons_per_day' => $row ? (int)$row['setting_value'] : 4]);
