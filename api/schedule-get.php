<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

requireLogin();

$pdo = getDB();
$stmt = $pdo->query('SELECT * FROM schedule ORDER BY id ASC');

jsonResponse(['schedule' => $stmt->fetchAll()]);
