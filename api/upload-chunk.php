<?php
require_once __DIR__ . '/session-helper.php';

requireLogin();

$sessionUrl = trim((string)($_SERVER['HTTP_X_DRIVE_UPLOAD_URL'] ?? ''));
$start = isset($_SERVER['HTTP_X_DRIVE_START']) ? (int)$_SERVER['HTTP_X_DRIVE_START'] : -1;
$end = isset($_SERVER['HTTP_X_DRIVE_END']) ? (int)$_SERVER['HTTP_X_DRIVE_END'] : -1;
$total = isset($_SERVER['HTTP_X_DRIVE_TOTAL']) ? (int)$_SERVER['HTTP_X_DRIVE_TOTAL'] : -1;
$mime = trim((string)($_SERVER['HTTP_X_DRIVE_MIME'] ?? 'application/octet-stream'));

if ($sessionUrl === '' || !preg_match('#^https://www\.googleapis\.com/upload/drive/v3/files\?uploadType=resumable&upload_id=[A-Za-z0-9_\-]+$#', $sessionUrl)) {
    jsonResponse(['error' => 'نشست آپلود Google Drive نامعتبره.'], 400);
}
if ($start < 0 || $end < $start || $total <= 0 || $end >= $total) {
    jsonResponse(['error' => 'بازه آپلود نامعتبره.'], 400);
}
$length = $end - $start + 1;

try {
    $fp = fopen('php://input', 'rb');
    if (!$fp) throw new Exception('ورودی فایل قابل خواندن نیست.');

    $ch = curl_init($sessionUrl);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => 'PUT',
        CURLOPT_UPLOAD => true,
        CURLOPT_INFILE => $fp,
        CURLOPT_INFILESIZE => $length,
        CURLOPT_HTTPHEADER => [
            'Content-Length: ' . $length,
            'Content-Type: ' . $mime,
            'Content-Range: bytes ' . $start . '-' . $end . '/' . $total,
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => false,
        CURLOPT_CONNECTTIMEOUT => 30,
        CURLOPT_TIMEOUT => 900,
    ]);

    $response = curl_exec($ch);
    $error = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    fclose($fp);

    if ($response === false || $error) throw new Exception('ارتباط با Google Drive: ' . $error);

    if ($code === 308) {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode(['success'=>true,'complete'=>false,'status'=>308], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $data = json_decode($response, true);
    if ($code >= 200 && $code < 300 && is_array($data) && !empty($data['id'])) {
        jsonResponse(['success'=>true,'complete'=>true,'file'=>$data]);
    }

    throw new Exception('Google Drive HTTP ' . $code . ' ' . $response);
} catch (Throwable $e) {
    jsonResponse(['error'=>'ارسال بخش فایل به Google Drive ناموفق بود: ' . $e->getMessage()], 502);
}
