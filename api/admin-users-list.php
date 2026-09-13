<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

requireRole(['admin']);

$pdo = getDB();
$stmt = $pdo->query('SELECT id, username, display_name, role FROM users ORDER BY display_name');

jsonResponse(['users' => $stmt->fetchAll()]);
