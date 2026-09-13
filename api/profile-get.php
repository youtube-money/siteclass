<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

$me = requireLogin();

$pdo = getDB();
$stmt = $pdo->prepare('SELECT id, username, display_name, role, avatar_emoji, bio, theme_color FROM users WHERE id = ?');
$stmt->execute([$me['id']]);

jsonResponse(['user' => $stmt->fetch()]);
