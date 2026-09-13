<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

$me = requireRole(['admin']);
$input = getJsonInput();
$name = trim($input['name'] ?? '');

if (!$name) {
    jsonResponse(['error' => 'اسم درس الزامیه'], 400);
}

$pdo = getDB();
$stmt = $pdo->prepare('INSERT INTO lesson_subjects (name, created_by) VALUES (?, ?)');
$stmt->execute([$name, $me['id']]);

jsonResponse(['success' => true, 'id' => $pdo->lastInsertId()]);
