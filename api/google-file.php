<?php
require_once __DIR__ . '/google-oauth.php';
require_once __DIR__ . '/google-drive.php';

/*
 * Public media proxy.
 * The Drive files are made public when finalized, so <img>/<video>/<audio>
 * can request this endpoint without an Authorization header from JavaScript.
 * PHP streams the bytes instead of buffering the whole file in RAM.
 */

$fileId = trim((string)($_GET['id'] ?? ''));
if ($fileId === '' || !preg_match('/^[A-Za-z0-9_-]+$/', $fileId)) {
    http_response_code(400);
    exit('شناسه فایل نامعتبر است.');
}

function driveProxyRequest(string $url, string $token, array $headers, callable $write): array {
    $responseHeaders = [];
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_HTTPHEADER => array_merge(["Authorization: Bearer $token"], $headers),
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 600,
        CURLOPT_CONNECTTIMEOUT => 30,
        CURLOPT_HEADERFUNCTION => function ($curl, $header) use (&$responseHeaders) {
            $line = trim($header);
            if ($line !== '' && strpos($line, ':') !== false) {
                [$name, $value] = array_map('trim', explode(':', $line, 2));
                $responseHeaders[strtolower($name)] = $value;
            }
            return strlen($header);
        },
        CURLOPT_WRITEFUNCTION => function ($curl, $chunk) use ($write) {
            return $write($chunk);
        },
    ]);

    $ok = curl_exec($ch);
    $error = curl_error($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return [$ok, $error, $code, $responseHeaders];
}

function publicDriveFallback(string $fileId): void {
    header('Location: https://drive.google.com/uc?export=download&id=' . rawurlencode($fileId), true, 302);
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
    if (!is_array($info) || empty($info['id'])) publicDriveFallback($fileId);

    $mime = (string)($info['mimeType'] ?? 'application/octet-stream');
    $name = (string)($info['name'] ?? 'file');
    $size = isset($info['size']) ? (int)$info['size'] : 0;
    $range = trim((string)($_SERVER['HTTP_RANGE'] ?? ''));
    $requestHeaders = [];

    if ($range !== '' && preg_match('/^bytes=(\d*)-(\d*)$/', $range, $m)) {
        if ($size <= 0) publicDriveFallback($fileId);

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
    $started = false;

    [$ok, $error, $code, $headers] = driveProxyRequest(
        $mediaUrl,
        $accessToken,
        $requestHeaders,
        function ($chunk) use (&$started, $isHead) {
            if (!$started) {
                $started = true;
            }
            if ($isHead) return strlen($chunk);
            echo $chunk;
            if (function_exists('ob_flush')) @ob_flush();
            flush();
            return strlen($chunk);
        }
    );

    if ($ok === false || $error || $code < 200 || $code >= 300) {
        publicDriveFallback($fileId);
    }

    http_response_code($code === 206 ? 206 : 200);
    header('Content-Type: ' . ($mime !== '' ? $mime : ($headers['content-type'] ?? 'application/octet-stream')));
    header('Accept-Ranges: bytes');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: public, max-age=300');

    if (!empty($headers['content-range'])) {
        header('Content-Range: ' . $headers['content-range']);
    }
    if (!empty($headers['content-length'])) {
        header('Content-Length: ' . $headers['content-length']);
    } elseif ($size > 0 && $code === 200) {
        header('Content-Length: ' . $size);
    }

    $safeName = str_replace(['"', "\\", "\r", "\n"], '', $name);
    header('Content-Disposition: inline; filename="' . $safeName . '"');

    if ($isHead) {
        exit;
    }
} catch (Throwable $e) {
    publicDriveFallback($fileId);
}
