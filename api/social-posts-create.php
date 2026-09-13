<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

$me = requireRole(['special', 'admin']);
$input = getJsonInput();
$content = trim($input['content'] ?? '');

if (!$content) {
    jsonResponse(['error' => 'متن پست خالیه'], 400);
}

$pdo = getDB();
$stmt = $pdo->prepare('INSERT INTO social_posts (user_id, content) VALUES (?, ?)');
$stmt->execute([$me['id'], $content]);

jsonResponse(['success' => true, 'id' => $pdo->lastInsertId()]);
