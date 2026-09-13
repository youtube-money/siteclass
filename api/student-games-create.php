<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

$me = requireLogin();
$input = getJsonInput();

$title = trim($input['title'] ?? '');
$description = trim($input['description'] ?? '');
$htmlContent = $input['html_content'] ?? '';
$fileLink = trim($input['file_link'] ?? '');

$maxSize = 300000; // ~300KB
if (!$title || (!$htmlContent && !$fileLink)) {
    jsonResponse(['error' => 'عنوان و کد HTML یا فایل آپلودی الزامیه'], 400);
}
if ($htmlContent && strlen($htmlContent) > $maxSize) {
    jsonResponse(['error' => 'کد خیلی بزرگه (حداکثر ۳۰۰ کیلوبایت)'], 400);
}

$pdo = getDB();
$stmt = $pdo->prepare(
    'INSERT INTO student_games (title, description, html_content, file_link, submitted_by) VALUES (?, ?, ?, ?, ?)'
);
$stmt->execute([$title, $description ?: null, $htmlContent ?: null, $fileLink ?: null, $me['id']]);

jsonResponse(['success' => true, 'id' => $pdo->lastInsertId()]);
