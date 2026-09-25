<?php
require_once __DIR__ . '/session-helper.php';
require_once __DIR__ . '/google-oauth.php';

requireLogin();

$fileId = trim((string)($_GET['id'] ?? ''));
if ($fileId === '' || !preg_match('/^[A-Za-z0-9_-]+$/', $fileId)) {
    http_response_code(400);
    exit('شناسه فایل نامعتبر است.');
}

function driveCurl(string $url, string $token, array $headers = [], bool $binary = false): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_HTTPHEADER => array_merge(["Authorization: Bearer $token"], $headers),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 300,
        CURLOPT_CONNECTTIMEOUT => 30,
        CURLOPT_HEADER => false,
    ]);
    $body = curl_exec($ch);
    $error = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    $contentLength = curl_getinfo($ch, CURLINFO_CONTENT_LENGTH_DOWNLOAD);
    $contentRange = curl_getinfo($ch, CURLINFO_CONTENT_RANGE);
    curl_close($ch);
    return compact('body','error','code','contentType','contentLength','contentRange');
}

try {
    $accessToken = googleOAuthGetAccessToken();

    $metaUrl = 'https://www.googleapis.com/drive/v3/files/' . rawurlencode($fileId) . '?fields=id,name,mimeType,size';
    $meta = driveCurl($metaUrl, $accessToken);
    if ($meta['body'] === false || $meta['error'] || $meta['code'] < 200 || $meta['code'] >= 300) {
        throw new Exception('خواندن اطلاعات فایل از Google Drive ناموفق بود.');
    }

    $info = json_decode((string)$meta['body'], true);
    if (!is_array($info) || empty($info['id'])) throw new Exception('اطلاعات فایل گوگل نامعتبر است.');

    $mime = (string)($info['mimeType'] ?? 'application/octet-stream');
    $name = (string)($info['name'] ?? 'file');
    $size = isset($info['size']) ? (int)$info['size'] : 0;

    $range = trim((string)($_SERVER['HTTP_RANGE'] ?? ''));
    $rangeHeader = '';
    if ($range !== '' && preg_match('/^bytes=(\d*)-(\d*)$/', $range, $m)) {
        $start = $m[1] === '' ? max(0, $size - (int)$m[2]) : (int)$m[1];
        $end = $m[2] === '' ? $size - 1 : (int)$m[2];
        if ($size <= 0 || $start < 0 || $start >= $size || $end < $start) {
            http_response_code(416);
            header('Content-Range: bytes */' . max(0, $size));
            exit;
        }
        $end = min($end, $size - 1);
        $rangeHeader = 'Range: bytes ' . $start . '-' . $end;
    }

    $mediaUrl = 'https://www.googleapis.com/drive/v3/files/' . rawurlencode($fileId) . '?alt=media';
    $media = driveCurl($mediaUrl, $accessToken, $rangeHeader ? [$rangeHeader] : []);

    if ($media['body'] === false || $media['error'] || $media['code'] < 200 || $media['code'] >= 300) {
        throw new Exception('دریافت فایل از Google Drive ناموفق بود. HTTP ' . $media['code']);
    }

    if ($rangeHeader && $media['code'] === 206) {
        http_response_code(206);
        if (!empty($media['contentRange'])) header('Content-Range: ' . $media['contentRange']);
    } else {
        http_response_code(200);
    }

    header('Content-Type: ' . $mime);
    header('Content-Length: ' . strlen((string)$media['body']));
    header('Accept-Ranges: bytes');
    header('Content-Disposition: inline; filename="' . str_replace(['"', "\\", "\r", "\n"], '', $name) . '"');
    header('Cache-Control: private, max-age=300');
    echo $media['body'];
} catch (Throwable $e) {
    http_response_code(502);
    header('Content-Type: text/plain; charset=UTF-8');
    echo $e->getMessage();
}
