<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

$me = requireLogin();
$input = getJsonInput();

$outingId = (int)($input['outing_id'] ?? 0);
$content = trim($input['content'] ?? '');

if (!$outingId || !$content) {
    jsonResponse(['error' => 'اطلاعات ناقصه'], 400);
}

$pdo = getDB();
$stmt = $pdo->prepare('INSERT INTO outing_comments (outing_id, user_id, content) VALUES (?, ?, ?)');
$stmt->execute([$outingId, $me['id'], $content]);

jsonResponse(['success' => true]);
