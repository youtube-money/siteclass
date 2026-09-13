<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

$me = requireLogin();
$projectId = (int)($_GET['project_id'] ?? 0);

$pdo = getDB();
$stmt = $pdo->prepare('SELECT code, language, updated_at FROM student_project_code WHERE user_id = ? AND project_id = ?');
$stmt->execute([$me['id'], $projectId]);
$row = $stmt->fetch();

jsonResponse(['code' => $row['code'] ?? '', 'language' => $row['language'] ?? 'python']);
