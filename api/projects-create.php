<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

$me = requireLogin();
if ($me['role'] !== 'admin') {
    jsonResponse(['error' => 'فقط ادمین می‌تونه پروژه/تکلیف اضافه کنه'], 403);
}

$input = getJsonInput();
$subject = trim($input['subject'] ?? '');
$title = trim($input['title'] ?? '');
$description = trim($input['description'] ?? '');

if (!$subject || !$title) {
    jsonResponse(['error' => 'درس و عنوان الزامیه'], 400);
}

$pdo = getDB();
$stmt = $pdo->prepare('INSERT INTO projects (subject, title, description, created_by) VALUES (?, ?, ?, ?)');
$stmt->execute([$subject, $title, $description ?: null, $me['id']]);

jsonResponse(['success' => true, 'id' => $pdo->lastInsertId()]);
