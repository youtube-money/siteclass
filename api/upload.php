<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';
require_once __DIR__ . '/google-drive.php';

$me = requireLogin();

if (!isset($_FILES['file'])) {
    jsonResponse(['error' => 'فایلی ارسال نشده.'], 400);
}

$file = $_FILES['file'];
$uploadErrors = [
    UPLOAD_ERR_INI_SIZE => 'حجم فایل از محدودیت PHP بیشتر است. بعد از انتشار نسخه جدید، .user.ini را چک کن.',
    UPLOAD_ERR_FORM_SIZE => 'حجم فایل از محدودیت فرم بیشتر است.',
    UPLOAD_ERR_PARTIAL => 'آپلود فایل ناقص انجام شد؛ دوباره امتحان کن.',
    UPLOAD_ERR_NO_FILE => 'هیچ فایلی انتخاب نشده.',
    UPLOAD_ERR_NO_TMP_DIR => 'پوشه موقت PHP پیدا نشد.',
    UPLOAD_ERR_CANT_WRITE => 'سرور نتوانست فایل موقت را روی دیسک ذخیره کند.',
    UPLOAD_ERR_EXTENSION => 'یک افزونه PHP آپلود فایل را متوقف کرده است.',
];

if ($file['error'] !== UPLOAD_ERR_OK) {
    jsonResponse(['error' => $uploadErrors[$file['error']] ?? ('خطای آپلود: ' . $file['error'])], 400);
}

$maxSize = 1024 * 1024 * 1024; // 1GB
if ((int)$file['size'] > $maxSize) {
    jsonResponse(['error' => 'حجم فایل بیشتر از حد مجاز ۱ گیگابایت است.'], 413);
}

try {
    $accessToken = getGoogleAccessToken(GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY);
    $mimeType = $file['type'] ?: 'application/octet-stream';
    $safeName = preg_replace('/[^a-zA-Z0-9._-]/', '_', basename($file['name'])) ?: 'upload.bin';

    $driveFile = uploadFileToDrive(
        $accessToken,
        GOOGLE_DRIVE_FOLDER_ID,
        $file['tmp_name'],
        time() . '_' . $safeName,
        $mimeType
    );

    makeDriveFilePublic($accessToken, $driveFile['id']);
    $directLink = 'https://drive.google.com/uc?export=view&id=' . rawurlencode($driveFile['id']);

    $pdo = getDB();
    $stmt = $pdo->prepare(
        'INSERT INTO uploads (uploader_id, filename, drive_file_id, drive_view_link) VALUES (?, ?, ?, ?)'
    );
    $stmt->execute([
        $me['id'],
        $file['name'],
        $driveFile['id'],
        $driveFile['webViewLink'] ?? 'https://drive.google.com/file/d/' . $driveFile['id'] . '/view',
    ]);

    jsonResponse([
        'success' => true,
        'fileId' => $driveFile['id'],
        'viewLink' => $driveFile['webViewLink'] ?? null,
        'directLink' => $directLink,
        'filename' => $file['name'],
        'mimeType' => $mimeType,
        'size' => (int)$file['size'],
    ]);
} catch (Throwable $e) {
    jsonResponse(['error' => 'آپلود انجام نشد: ' . $e->getMessage()], 502);
}
