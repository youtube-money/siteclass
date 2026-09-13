<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

requireRole(['admin']);
$input = getJsonInput();

$userId = (int)($input['user_id'] ?? 0);
$role = $input['role'] ?? '';

if (!$userId || !in_array($role, ['student', 'special', 'admin'], true)) {
    jsonResponse(['error' => 'اطلاعات نامعتبره'], 400);
}

$pdo = getDB();
$stmt = $pdo->prepare('UPDATE users SET role = ? WHERE id = ?');
$stmt->execute([$role, $userId]);

jsonResponse(['success' => true]);
