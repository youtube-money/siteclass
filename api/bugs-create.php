<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

$me = requireLogin();
$input = getJsonInput();

$title = trim($input['title'] ?? '');
$description = trim($input['description'] ?? '');

if (!$title) {
    jsonResponse(['error' => 'عنوان مشکل الزامیه'], 400);
}

$pdo = getDB();
$stmt = $pdo->prepare('INSERT INTO bug_reports (title, description, reported_by) VALUES (?, ?, ?)');
$stmt->execute([$title, $description ?: null, $me['id']]);

jsonResponse(['success' => true, 'id' => $pdo->lastInsertId()]);
