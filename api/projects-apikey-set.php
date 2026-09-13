<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

$me = requireLogin();
$input = getJsonInput();

$projectId = (int)($input['project_id'] ?? 0);
$apiKey = trim($input['api_key'] ?? '');

if (!$projectId || strlen($apiKey) < 10) {
    jsonResponse(['error' => 'کلید API نامعتبره'], 400);
}

$pdo = getDB();
$stmt = $pdo->prepare(
    'INSERT INTO student_api_keys (user_id, project_id, api_key, updated_at)
     VALUES (?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE api_key = VALUES(api_key), updated_at = NOW()'
);
$stmt->execute([$me['id'], $projectId, $apiKey]);

jsonResponse(['success' => true]);
