<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

$me = requireLogin();

$pdo = getDB();
$stmt = $pdo->prepare('SELECT id, display_name, username FROM users WHERE id != ? ORDER BY display_name');
$stmt->execute([$me['id']]);

jsonResponse(['contacts' => $stmt->fetchAll()]);
