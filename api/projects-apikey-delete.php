<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

$me = requireLogin();
$input = getJsonInput();
$projectId = (int)($input['project_id'] ?? 0);

$pdo = getDB();
$stmt = $pdo->prepare('DELETE FROM student_api_keys WHERE user_id = ? AND project_id = ?');
$stmt->execute([$me['id'], $projectId]);

jsonResponse(['success' => true]);
