<?php
require_once __DIR__ . '/google-oauth.php';
require_once __DIR__ . '/google-drive.php';

/*
 * Public media proxy.
 * Drive files are made public when finalized, but the browser talks only to
 * this endpoint. Google Drive bytes are streamed without buffering the file.
 */

$fileId = trim((string)($_GET['id'] ?? ''));
if ($fileId === '' || !preg_match('/^[A-Za-z0-9_-]+$/', $fileId)) {
    http_response_code(400);
    exit('شناسه فایل نامعتبر است.');
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
    if (!is_array($info) || empty($info['id'])) {
        publicDriveFallback($fileId);
    }

    $mime = (string)($info['mimeType'] ?? 'application/octet-stream');
    $name = (string)($info['name'] ?? 'file');
    $size = isset($info['size']) ? (int)$info['size'] : 0;

    $range = trim((string)($_SERVER['HTTP_RANGE'] ?? ''));
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
    $headersSent = false;

    $ch = curl_init($mediaUrl);
    curl_setopt_array($ch, [
        CURLOPT_HTTPHEADER => array_merge(["Authorization: Bearer $accessToken"], $requestHeaders),
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 600,
        CURLOPT_CONNECTTIMEOUT => 30,

        // IMPORTANT: Google sends response headers before body. We must send
        // the browser's Content-Type/Range headers before echoing any bytes.
        CURLOPT_HEADERFUNCTION => function ($curl, $header) use (&$headersSent, $mime, $name, $size) {
            $line = trim($header);

            if (preg_match('/^HTTP\/\d(?:\.\d)?\s+(\d{3})/', $line, $status)) {
                $code = (int)$status[1];
                if ($code >= 200 && $code < 400) {
                    http_response_code($code);
                    $headersSent = true;
                }
                return strlen($header);
            }

            if ($line === '' || strpos($line, ':') === false) {
                return strlen($header);
            }

            [$rawName, $rawValue] = array_map('trim', explode(':', $line, 2));
            $lower = strtolower($rawName);

            if ($lower === 'content-type') {
                header('Content-Type: ' . ($mime !== '' ? $mime : $rawValue));
            } elseif ($lower === 'content-length') {
                header('Content-Length: ' . $rawValue);
            } elseif ($lower === 'content-range') {
                header('Content-Range: ' . $rawValue);
            }

            return strlen($header);
        },

        CURLOPT_WRITEFUNCTION => function ($curl, $chunk) use ($isHead) {
            if (!$isHead) {
                echo $chunk;
                if (function_exists('ob_flush')) @ob_flush();
                flush();
            }
            return strlen($chunk);
        },
    ]);

    // These are safe to send before the upstream body starts.
    header('Content-Type: ' . ($mime !== '' ? $mime : 'application/octet-stream'));
    header('Accept-Ranges: bytes');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: public, max-age=300');
    $safeName = str_replace(['"', "\\", "\r", "\n"], '', $name);
    header('Content-Disposition: inline; filename="' . $safeName . '"');

    $ok = curl_exec($ch);
    $error = curl_error($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($ok === false || $error || $code < 200 || $code >= 300) {
        // If output has already started, a redirect cannot be used safely.
        if (!headers_sent()) publicDriveFallback($fileId);
        exit;
    }

    // If Google did not provide Content-Length for a full response, use the
    // Drive metadata size. Never override a 206 Content-Length.
    if (!$range && $size > 0 && !headers_sent()) {
        header('Content-Length: ' . $size);
    }

    exit;
} catch (Throwable $e) {
    if (!headers_sent()) {
        publicDriveFallback($fileId);
    }
    exit;
}
