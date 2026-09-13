<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

$me = requireLogin();
$input = getJsonInput();

$bugId = (int)($input['bug_id'] ?? 0);
$content = trim($input['content'] ?? '');

if (!$bugId || !$content) {
    jsonResponse(['error' => 'اطلاعات ناقصه'], 400);
}

$pdo = getDB();
$stmt = $pdo->prepare('INSERT INTO bug_comments (bug_id, user_id, content) VALUES (?, ?, ?)');
$stmt->execute([$bugId, $me['id'], $content]);

jsonResponse(['success' => true]);
