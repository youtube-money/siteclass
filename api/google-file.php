<?php
require_once __DIR__ . '/session-helper.php';
require_once __DIR__ . '/google-oauth.php';

requireLogin();

$fileId = trim((string)($_GET['id'] ?? ''));
if ($fileId === '' || !preg_match('/^[A-Za-z0-9_-]+$/', $fileId)) {
    http_response_code(400);
    exit('شناسه فایل نامعتبر است.');
}

try {
    $accessToken = googleOAuthGetAccessToken();

    $metaUrl = 'https://www.googleapis.com/drive/v3/files/' . rawurlencode($fileId) . '?fields=id,name,mimeType,size';
    $ch = curl_init($metaUrl);
    curl_setopt_array($ch, [
        CURLOPT_HTTPHEADER => ["Authorization: Bearer $accessToken"],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
    ]);
    $metaResponse = curl_exec($ch);
    $metaError = curl_error($ch);
    $metaCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($metaResponse === false || $metaError || $metaCode < 200 || $metaCode >= 300) {
        throw new Exception('خواندن اطلاعات فایل ناموفق بود.');
    }

    $meta = json_decode($metaResponse, true);
    $mime = (string)($meta['mimeType'] ?? 'application/octet-stream');
    $name = (string)($meta['name'] ?? 'file');

    $mediaUrl = 'https://www.googleapis.com/drive/v3/files/' . rawurlencode($fileId) . '?alt=media';
    $ch = curl_init($mediaUrl);
    curl_setopt_array($ch, [
        CURLOPT_HTTPHEADER => ["Authorization: Bearer $accessToken"],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 300,
        CURLOPT_CONNECTTIMEOUT => 30,
    ]);
    $body = curl_exec($ch);
    $error = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($body === false || $error || $code < 200 || $code >= 300) {
        throw new Exception('دریافت فایل از Google Drive ناموفق بود.');
    }

    header('Content-Type: ' . $mime);
    header('Content-Length: ' . strlen($body));
    header('Content-Disposition: inline; filename="' . str_replace(['"', "\\", "\r", "\n"], '', $name) . '"');
    header('Cache-Control: private, max-age=300');
    echo $body;
} catch (Throwable $e) {
    http_response_code(502);
    header('Content-Type: text/plain; charset=UTF-8');
    echo $e->getMessage();
}
