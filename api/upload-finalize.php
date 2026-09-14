<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';
require_once __DIR__ . '/google-drive.php';

$me = requireLogin();
$input = getJsonInput();
$fileId = trim((string)($input['fileId'] ?? ''));
$filename = trim((string)($input['filename'] ?? 'upload'));
$size = (int)($input['size'] ?? 0);
$mimeType = trim((string)($input['mimeType'] ?? 'application/octet-stream'));

if ($fileId === '' || $size <= 0 || $size > 1024 * 1024 * 1024) {
    jsonResponse(['error' => 'اطلاعات فایل نامعتبره.'], 400);
}
if (!preg_match('/^[A-Za-z0-9_-]+$/', $fileId)) {
    jsonResponse(['error' => 'شناسه فایل گوگل نامعتبره.'], 400);
}

try {
    $accessToken = getGoogleAccessToken(GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY);
    $driveFile = getDriveFileMetadata($accessToken, $fileId);
    if (!$driveFile || empty($driveFile['id'])) throw new Exception('فایل در Google Drive پیدا نشد.');
    if (isset($driveFile['size']) && (int)$driveFile['size'] !== $size) throw new Exception('اندازه فایل با اطلاعات ارسالی یکسان نیست.');

    makeDriveFilePublic($accessToken, $fileId);
    $directLink = 'https://drive.google.com/uc?export=view&id=' . rawurlencode($fileId);
    $viewLink = $driveFile['webViewLink'] ?? 'https://drive.google.com/file/d/'.$fileId.'/view';

    $pdo = getDB();
    $stmt = $pdo->prepare('INSERT INTO uploads (uploader_id, filename, drive_file_id, drive_view_link) VALUES (?, ?, ?, ?)');
    $stmt->execute([$me['id'], $filename ?: ($driveFile['name'] ?? 'upload'), $fileId, $viewLink]);

    jsonResponse(['success'=>true,'fileId'=>$fileId,'viewLink'=>$viewLink,'directLink'=>$directLink,'filename'=>$filename,'mimeType'=>$mimeType,'size'=>$size]);
} catch (Throwable $e) {
    jsonResponse(['error'=>'ثبت فایل ناموفق بود: '.$e->getMessage()], 502);
}
