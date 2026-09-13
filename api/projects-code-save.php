<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

$me = requireLogin();
$input = getJsonInput();

$projectId = (int)($input['project_id'] ?? 0);
$code = $input['code'] ?? '';
$language = trim($input['language'] ?? 'python');

if (!$projectId) {
    jsonResponse(['error' => 'پروژه مشخص نشده'], 400);
}

$pdo = getDB();
$stmt = $pdo->prepare(
    'INSERT INTO student_project_code (user_id, project_id, code, language, updated_at)
     VALUES (?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE code = VALUES(code), language = VALUES(language), updated_at = NOW()'
);
$stmt->execute([$me['id'], $projectId, $code, $language]);

jsonResponse(['success' => true]);
