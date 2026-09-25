<?php
require_once __DIR__ . '/google-oauth.php';
require_once __DIR__ . '/google-drive.php';

$fileId = trim((string)($_GET['id'] ?? ''));
if ($fileId === '' || !preg_match('/^[A-Za-z0-9_-]+$/', $fileId)) {
    http_response_code(400);
    exit('شناسه فایل نامعتبر است.');
}

while (ob_get_level() > 0) {
    @ob_end_clean();
}

function publicDriveFallback(string $fileId): void {
    if (!headers_sent()) {
        header('Location: https://drive.google.com/uc?export=download&id=' . rawurlencode($fileId), true, 302);
    }
    exit;
}

try {
    $accessToken = googleOAuthGetAccessToken();

    $metaUrl = 'https://www.googleapis.com/drive/v3/files/' . rawurlencode($fileId)
        . '?fields=id,name,mimeType,size';

    $metaCh = curl_init($metaUrl);
    curl_setopt_array($metaCh, [
        CURLOPT_HTTPHEADER => ["Authorization: Bearer $accessToken"],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 60,
        CURLOPT_CONNECTTIMEOUT => 30,
    ]);
    $metaBody = curl_exec($metaCh);
    $metaError = curl_error($metaCh);
    $metaCode = (int)curl_getinfo($metaCh, CURLINFO_HTTP_CODE);
    curl_close($metaCh);

    if ($metaBody === false || $metaError || $metaCode < 200 || $metaCode >= 300) {
        publicDriveFallback($fileId);
    }

    $info = json_decode((string)$metaBody, true);
    if (!is_array($info) || empty($info['id'])) {
        publicDriveFallback($fileId);
    }

    $mime = (string)($info['mimeType'] ?? 'application/octet-stream');
    $name = (string)($info['name'] ?? 'file');
    $size = isset($info['size']) ? (int)$info['size'] : 0;
    $range = trim((string)($_SERVER['HTTP_RANGE'] ?? ''));

    // Images are buffered before sending anything to the browser. This makes
    // the image response deterministic on shared/cPanel PHP hosting.
    if (strpos($mime, 'image/') === 0 && $range === '') {
        $mediaUrl = 'https://www.googleapis.com/drive/v3/files/' . rawurlencode($fileId) . '?alt=media';
        $ch = curl_init($mediaUrl);
        curl_setopt_array($ch, [
            CURLOPT_HTTPHEADER => ["Authorization: Bearer $accessToken"],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => 180,
            CURLOPT_CONNECTTIMEOUT => 30,
        ]);

        $body = curl_exec($ch);
        $error = curl_error($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $upstreamType = (string)curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
        curl_close($ch);

        if ($body === false || $error || $code < 200 || $code >= 300 || $body === '') {
            publicDriveFallback($fileId);
        }

        http_response_code(200);
        header('Content-Type: ' . ($mime !== '' ? $mime : ($upstreamType ?: 'application/octet-stream')));
        header('Content-Length: ' . strlen($body));
        header('Accept-Ranges: bytes');
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: public, max-age=300');
        $safeName = str_replace(['"', "\", "", "
"], '', $name);
        header('Content-Disposition: inline; filename="' . $safeName . '"');
        echo $body;
        exit;
    }

    $requestHeaders = [];
    if ($range !== '') {
        if (!preg_match('/^bytes=(\d*)-(\d*)$/', $range, $m) || $size <= 0) {
            http_response_code(416);
            if ($size > 0) header('Content-Range: bytes */' . $size);
            exit;
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
    $isHead = ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'HEAD';

    $ch = curl_init($mediaUrl);
    curl_setopt_array($ch, [
        CURLOPT_HTTPHEADER => array_merge(["Authorization: Bearer $accessToken"], $requestHeaders),
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 600,
        CURLOPT_CONNECTTIMEOUT => 30,
        CURLOPT_WRITEFUNCTION => function ($curl, $chunk) use ($isHead) {
            if (!$isHead) {
                echo $chunk;
                flush();
            }
            return strlen($chunk);
        },
    ]);

    header('Content-Type: ' . ($mime !== '' ? $mime : 'application/octet-stream'));
    header('Accept-Ranges: bytes');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: public, max-age=300');
    $safeName = str_replace(['"', "\", "", "
"], '', $name);
    header('Content-Disposition: inline; filename="' . $safeName . '"');

    $ok = curl_exec($ch);
    $error = curl_error($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $length = curl_getinfo($ch, CURLINFO_CONTENT_LENGTH_DOWNLOAD_T);
    curl_close($ch);

    if ($ok === false || $error || $code < 200 || $code >= 300) {
        if (!headers_sent()) publicDriveFallback($fileId);
        exit;
    }

    http_response_code($code === 206 ? 206 : 200);
    if ((int)$length > 0) {
        header('Content-Length: ' . (int)$length);
    } elseif (!$range && $size > 0) {
        header('Content-Length: ' . $size);
    }
    exit;
} catch (Throwable $e) {
    if (!headers_sent()) {
        publicDriveFallback($fileId);
    }
    exit;
}
