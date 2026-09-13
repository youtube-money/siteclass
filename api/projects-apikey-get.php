<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

$me = requireLogin();
$projectId = (int)($_GET['project_id'] ?? 0);

$pdo = getDB();
$stmt = $pdo->prepare('SELECT api_key, updated_at FROM student_api_keys WHERE user_id = ? AND project_id = ?');
$stmt->execute([$me['id'], $projectId]);
$row = $stmt->fetch();

if (!$row) {
    jsonResponse(['hasKey' => false]);
}

jsonResponse([
    'hasKey' => true,
    'lastFourChars' => substr($row['api_key'], -4),
    'updatedAt' => $row['updated_at'],
]);
