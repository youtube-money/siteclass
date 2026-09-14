<?php
require_once __DIR__ . '/session-helper.php';
require_once __DIR__ . '/google-oauth.php';

requireLogin();

$sessionUrl = trim((string)($_GET['uploadUrl'] ?? ''));
$start = isset($_GET['start']) ? (int)$_GET['start'] : -1;
$end = isset($_GET['end']) ? (int)$_GET['end'] : -1;
$total = isset($_GET['total']) ? (int)$_GET['total'] : -1;
$mime = trim((string)($_GET['mime'] ?? 'application/octet-stream')) ?: 'application/octet-stream';

if (
    $sessionUrl === '' ||
    !filter_var($sessionUrl, FILTER_VALIDATE_URL) ||
    !str_starts_with($sessionUrl, 'https://www.googleapis.com/')
) {
    jsonResponse(['error' => 'نشست آپلود Google Drive نامعتبره.'], 400);
}
if ($start < 0 || $end < $start || $total <= 0 || $end >= $total) {
    jsonResponse(['error' => 'بازه آپلود نامعتبره.'], 400);
}
$length = $end - $start + 1;

try {
    $accessToken = googleOAuthGetAccessToken();
    $fp = fopen('php://input', 'rb');
    if (!$fp) throw new Exception('ورودی فایل قابل خواندن نیست.');

    $ch = curl_init($sessionUrl);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => 'PUT',
        CURLOPT_UPLOAD => true,
        CURLOPT_INFILE => $fp,
        CURLOPT_INFILESIZE => $length,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $accessToken,
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

    $data = json_decode((string)$response, true);
    $detail = is_array($data) && !empty($data['error']['message']) ? $data['error']['message'] : trim((string)$response);
    error_log('[SITECLASS DRIVE] chunk: http=' . $code . ' start=' . $start . ' end=' . $end . ' total=' . $total . ' mime=' . $mime . ($detail !== '' ? ' response=' . substr($detail, 0, 1000) : ''));

    if ($response === false || $error) throw new Exception('ارتباط با Google Drive: ' . $error);

    if ($code === 308) {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode(['success'=>true,'complete'=>false,'status'=>308], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($code >= 200 && $code < 300 && is_array($data) && !empty($data['id'])) {
        jsonResponse(['success'=>true,'complete'=>true,'file'=>$data]);
    }

    throw new Exception('Google Drive HTTP ' . $code . ($detail !== '' ? ' - ' . $detail : ''));
} catch (Throwable $e) {
    error_log('[SITECLASS DRIVE] chunk exception: ' . $e->getMessage());
    jsonResponse(['error'=>'ارسال بخش فایل به Google Drive ناموفق بود: ' . $e->getMessage()], 502);
}
