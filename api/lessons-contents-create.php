<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

$me = requireLogin();
$input = getJsonInput();

$subjectId = (int)($input['subject_id'] ?? 0);
$content = trim($input['content'] ?? '');
$fileLink = trim($input['file_link'] ?? '');

if (!$subjectId || (!$content && !$fileLink)) {
    jsonResponse(['error' => 'محتوا یا لینک فایل الزامیه'], 400);
}

$pdo = getDB();
$stmt = $pdo->prepare('INSERT INTO lesson_contents (subject_id, user_id, content, file_link) VALUES (?, ?, ?, ?)');
$stmt->execute([$subjectId, $me['id'], $content ?: null, $fileLink ?: null]);

jsonResponse(['success' => true, 'id' => $pdo->lastInsertId()]);
