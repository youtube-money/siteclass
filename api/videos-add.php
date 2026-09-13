<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

$me = requireLogin();
$input = getJsonInput();

$title = trim($input['title'] ?? '');
$description = trim($input['description'] ?? '');
$videoUrl = trim($input['video_url'] ?? '');

if (!$title || !$videoUrl) {
    jsonResponse(['error' => 'عنوان و لینک ویدیو الزامیه'], 400);
}

$pdo = getDB();
$stmt = $pdo->prepare('INSERT INTO videos (title, description, video_url, added_by) VALUES (?, ?, ?, ?)');
$stmt->execute([$title, $description ?: null, $videoUrl, $me['id']]);

jsonResponse(['success' => true, 'id' => $pdo->lastInsertId()]);
