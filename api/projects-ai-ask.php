<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';
require_once __DIR__ . '/gemini.php';

$me = requireLogin();
$input = getJsonInput();

$projectId = (int)($input['project_id'] ?? 0);
$message = trim($input['message'] ?? '');

if (!$projectId || !$message) {
    jsonResponse(['error' => 'اطلاعات ناقصه'], 400);
}

$pdo = getDB();

$keyRow = $pdo->prepare('SELECT api_key FROM student_api_keys WHERE user_id = ? AND project_id = ?');
$keyRow->execute([$me['id'], $projectId]);
$keyRow = $keyRow->fetch();

if (!$keyRow) {
    jsonResponse(['error' => 'اول باید کلید API خودت رو برای این پروژه ذخیره کنی'], 400);
}

// حافظه بین همهٔ پروژه‌های خودِ همین دانش‌آموز مشترکه (نه فقط همین پروژه)
$historyStmt = $pdo->prepare(
    'SELECT role, message FROM student_ai_conversations WHERE user_id = ? ORDER BY id ASC LIMIT 30'
);
$historyStmt->execute([$me['id']]);
$history = $historyStmt->fetchAll();

try {
    $reply = callGemini($keyRow['api_key'], $history, $message);
} catch (Exception $e) {
    jsonResponse(['error' => 'دستیارت جواب نداد — شاید کلیدت نامعتبره یا سهمیه‌اش تموم شده'], 502);
}

$insert = $pdo->prepare('INSERT INTO student_ai_conversations (user_id, role, message) VALUES (?, ?, ?)');
$insert->execute([$me['id'], 'user', $message]);
$insert->execute([$me['id'], 'model', $reply]);

jsonResponse(['reply' => $reply]);
