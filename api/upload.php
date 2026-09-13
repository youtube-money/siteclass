<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';
require_once __DIR__ . '/google-drive.php';

$me = requireLogin();

if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    jsonResponse(['error' => 'فایلی ارسال نشده یا آپلودش با خطا مواجه شد'], 400);
}

$file = $_FILES['file'];
$maxSize = 50 * 1024 * 1024; // ۵۰ مگابایت
if ($file['size'] > $maxSize) {
    jsonResponse(['error' => 'حجم فایل بیشتر از حد مجاز (۵۰ مگابایت) است'], 400);
}

try {
    $accessToken = getGoogleAccessToken(GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY);
    $driveFile = uploadFileToDrive(
        $accessToken,
        GOOGLE_DRIVE_FOLDER_ID,
        $file['tmp_name'],
        time() . '_' . $file['name'],
        $file['type'] ?: 'application/octet-stream'
    );
    makeDriveFilePublic($accessToken, $driveFile['id']);
    $directLink = 'https://drive.google.com/uc?export=view&id=' . $driveFile['id'];

    $pdo = getDB();
    $stmt = $pdo->prepare(
        'INSERT INTO uploads (uploader_id, filename, drive_file_id, drive_view_link) VALUES (?, ?, ?, ?)'
    );
    $stmt->execute([$me['id'], $file['name'], $driveFile['id'], $driveFile['webViewLink']]);

    jsonResponse([
        'success' => true,
        'fileId' => $driveFile['id'],
        'viewLink' => $driveFile['webViewLink'],
        'directLink' => $directLink,
    ]);
} catch (Exception $e) {
    jsonResponse(['error' => $e->getMessage()], 502);
}
