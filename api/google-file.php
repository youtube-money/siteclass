<?php
require_once __DIR__ . '/session-helper.php';
require_once __DIR__ . '/google-oauth.php';
require_once __DIR__ . '/google-drive.php';

requireLogin();

$fileId = trim((string)($_GET['id'] ?? ''));
if ($fileId === '' || !preg_match('/^[A-Za-z0-9_-]+$/', $fileId)) {
    http_response_code(400);
    exit('شناسه فایل نامعتبر است.');
}

function driveRequest(string $url, string $token, array $headers = []): array {
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
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $contentType = (string)curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    $contentRange = (string)curl_getinfo($ch, CURLINFO_CONTENT_RANGE);
    curl_close($ch);
    return compact('body','error','code','contentType','contentRange');
}

function publicDriveFallback(string $fileId): void {
    // Files are made public at finalize time. This fallback also helps older files.
    header('Location: https://drive.google.com/uc?export=download&id=' . rawurlencode($fileId), true, 302);
    exit;
}

try {
    $accessToken = googleOAuthGetAccessToken();

    $metaUrl = 'https://www.googleapis.com/drive/v3/files/' . rawurlencode($fileId)
        . '?fields=id,name,mimeType,size,webContentLink,webViewLink';
    $meta = driveRequest($metaUrl, $accessToken);

    if ($meta['body'] === false || $meta['error'] || $meta['code'] < 200 || $meta['code'] >= 300) {
        // If an old file is already public, let Google serve it directly.
        publicDriveFallback($fileId);
    }

    $info = json_decode((string)$meta['body'], true);
    if (!is_array($info) || empty($info['id'])) publicDriveFallback($fileId);

    $mime = (string)($info['mimeType'] ?? 'application/octet-stream');
    $name = (string)($info['name'] ?? 'file');
    $size = isset($info['size']) ? (int)$info['size'] : 0;

    $range = trim((string)($_SERVER['HTTP_RANGE'] ?? ''));
    $requestHeaders = [];

    if ($range !== '' && preg_match('/^bytes=(\d*)-(\d*)$/', $range, $m)) {
        if ($size <= 0) {
            publicDriveFallback($fileId);
        }
        $start = $m[1] === '' ? max(0, $size - (int)$m[2]) : (int)$m[1];
        $end = $m[2] === '' ? $size - 1 : (int)$m[2];
        if ($start < 0 || $start >= $size || $end < $start) {
            http_response_code(416);
            header('Content-Range: bytes */' . $size);
            exit;
        }
        $end = min($end, $size - 1);
        $requestHeaders[] = 'Range: bytes ' . $start . '-' . $end;
    }

    $mediaUrl = 'https://www.googleapis.com/drive/v3/files/' . rawurlencode($fileId) . '?alt=media';
    $media = driveRequest($mediaUrl, $accessToken, $requestHeaders);

    if ($media['body'] === false || $media['error'] || $media['code'] < 200 || $media['code'] >= 300) {
        // Public fallback makes images/videos usable even when the OAuth scope cannot read an older file.
        publicDriveFallback($fileId);
    }

    http_response_code($media['code'] === 206 ? 206 : 200);
    if ($media['code'] === 206 && $media['contentRange'] !== '') {
        header('Content-Range: ' . $media['contentRange']);
    }
    header('Content-Type: ' . ($mime !== '' ? $mime : ($media['contentType'] ?: 'application/octet-stream')));
    header('Content-Length: ' . strlen((string)$media['body']));
    header('Accept-Ranges: bytes');
    header('X-Content-Type-Options: nosniff');
    header('Content-Disposition: inline; filename="' . str_replace(['"', "\\", "\r", "\n"], '', $name) . '"');
    header('Cache-Control: private, max-age=300');
    echo $media['body'];
} catch (Throwable $e) {
    // Last-resort path for public Drive files.
    publicDriveFallback($fileId);
}
