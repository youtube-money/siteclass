<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';
require_once __DIR__ . '/google-drive.php';

requireLogin();

$gameId = (int)($_GET['id'] ?? 0);

$pdo = getDB();
$stmt = $pdo->prepare('SELECT file_link FROM student_games WHERE id = ?');
$stmt->execute([$gameId]);
$game = $stmt->fetch();

if (!$game || !$game['file_link']) {
    http_response_code(404);
    echo 'پیدا نشد';
    exit;
}

// file_link برای بازی‌های آپلودی، شناسهٔ فایل گوگل‌درایوه (نه لینک کامل)
$driveFileId = $game['file_link'];

try {
    $accessToken = getGoogleAccessToken(GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY);

    $ch = curl_init("https://www.googleapis.com/drive/v3/files/$driveFileId?alt=media");
    curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer $accessToken"]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $content = curl_exec($ch);
    curl_close($ch);

    header('Content-Type: text/html; charset=utf-8');
    echo $content;
} catch (Exception $e) {
    http_response_code(502);
    echo 'خطا در دریافت فایل بازی';
}
