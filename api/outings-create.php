<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

$me = requireLogin();
$input = getJsonInput();

$title = trim($input['title'] ?? '');
$location = trim($input['location'] ?? '');
$description = trim($input['description'] ?? '');

if (!$title) {
    jsonResponse(['error' => 'عنوان ایده الزامیه'], 400);
}

$pdo = getDB();
$stmt = $pdo->prepare('INSERT INTO outings (title, location, description, created_by) VALUES (?, ?, ?, ?)');
$stmt->execute([$title, $location ?: null, $description ?: null, $me['id']]);

jsonResponse(['success' => true, 'id' => $pdo->lastInsertId()]);
