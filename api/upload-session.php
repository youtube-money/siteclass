<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/session-helper.php';
require_once __DIR__ . '/google-oauth.php';

requireLogin();
$input = getJsonInput();
$name = trim((string)($input['name'] ?? ''));
$mimeType = trim((string)($input['mimeType'] ?? 'application/octet-stream'));
$size = (int)($input['size'] ?? 0);

if ($name === '' || $size <= 0) jsonResponse(['error' => 'نام یا اندازه فایل نامعتبره.'], 400);
if ($size > 1024 * 1024 * 1024) jsonResponse(['error' => 'حجم فایل بیشتر از حد مجاز ۱ گیگابایت است.'], 413);
if (strlen($name) > 240) $name = substr($name, 0, 240);
if (!preg_match('/^[\w.\- ()\[\]آ-ی]+$/u', $name)) $name = preg_replace('/[^\p{L}\p{N}._()\[\] -]/u', '_', $name) ?: 'upload.bin';

try {
    $accessToken = googleOAuthGetAccessToken();
    $metadata = json_encode([
        'name' => time() . '_' . $name,
        'parents' => [GOOGLE_DRIVE_FOLDER_ID],
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    $sessionUrl = null;
    $ch = curl_init('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size,webViewLink');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $metadata,
        CURLOPT_HTTPHEADER => [
            "Authorization: Bearer $accessToken",
            'Content-Type: application/json; charset=UTF-8',
            "X-Upload-Content-Type: $mimeType",
            "X-Upload-Content-Length: $size",
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADERFUNCTION => function ($curl, $header) use (&$sessionUrl) {
            if (stripos($header, 'Location:') === 0) $sessionUrl = trim(substr($header, strlen('Location:')));
            return strlen($header);
        },
        CURLOPT_TIMEOUT => 30,
    ]);
    $response = curl_exec($ch); $error = curl_error($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    if ($response === false || $error || $code < 200 || $code >= 300 || !$sessionUrl) throw new Exception('نشست آپلود گوگل ساخته نشد: HTTP ' . $code . ' ' . $error . ' ' . $response);
    jsonResponse(['success'=>true,'uploadUrl'=>$sessionUrl,'name'=>$name,'size'=>$size,'mimeType'=>$mimeType]);
} catch (Throwable $e) {
    jsonResponse(['error'=>'شروع آپلود ناموفق بود: '.$e->getMessage()], 502);
}
