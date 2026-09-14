<?php
require_once __DIR__ . '/session-helper.php';
require_once __DIR__ . '/google-oauth.php';

requireLogin();

$uploadId = trim((string)($_POST['uploadId'] ?? ''));
$start = isset($_POST['start']) ? (int)$_POST['start'] : -1;
$end = isset($_POST['end']) ? (int)$_POST['end'] : -1;
$total = isset($_POST['total']) ? (int)$_POST['total'] : -1;

if (!preg_match('/^[a-f0-9]{48}$/', $uploadId)) jsonResponse(['error' => 'شناسه آپلود نامعتبره.'], 400);
if ($start < 0 || $end < $start || $total <= 0 || $end >= $total) jsonResponse(['error' => 'بازه آپلود نامعتبره.'], 400);

$sessionFile = dirname(__DIR__) . '/.sessions/drive-uploads/' . $uploadId . '.json';
if (!is_file($sessionFile)) jsonResponse(['error' => 'نشست آپلود پیدا نشد یا منقضی شده. دوباره آپلود را شروع کن.'], 404);

$session = json_decode((string)file_get_contents($sessionFile), true);
if (!is_array($session) || empty($session['upload_url'])) jsonResponse(['error' => 'اطلاعات نشست آپلود نامعتبره.'], 400);
if ((int)($session['size'] ?? 0) !== $total) jsonResponse(['error' => 'اندازه فایل با نشست آپلود یکی نیست.'], 400);
if (time() - (int)($session['created_at'] ?? 0) > 86400) {
    @unlink($sessionFile);
    jsonResponse(['error' => 'نشست آپلود منقضی شده. دوباره آپلود را شروع کن.'], 410);
}

$sessionUrl = (string)$session['upload_url'];
if (!filter_var($sessionUrl, FILTER_VALIDATE_URL) || !str_starts_with($sessionUrl, 'https://www.googleapis.com/')) {
    jsonResponse(['error' => 'آدرس نشست Google Drive نامعتبره.'], 400);
}

if (empty($_FILES['chunk']) || !isset($_FILES['chunk']['tmp_name']) || $_FILES['chunk']['error'] !== UPLOAD_ERR_OK) {
    $uploadError = (int)($_FILES['chunk']['error'] ?? -1);
    jsonResponse(['error' => 'بخش فایل به سرور نرسید. کد آپلود: ' . $uploadError], 400);
}

$tmp = $_FILES['chunk']['tmp_name'];
$length = $end - $start + 1;
$actualSize = (int)($_FILES['chunk']['size'] ?? 0);
if ($actualSize !== $length) {
    @unlink($tmp);
    jsonResponse(['error' => 'اندازه بخش فایل درست نیست.'], 400);
}

$mime = (string)($session['mimeType'] ?? 'application/octet-stream');

try {
    $accessToken = googleOAuthGetAccessToken();
    $fp = fopen($tmp, 'rb');
    if (!$fp) throw new Exception('بخش فایل قابل خواندن نیست.');

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
    @unlink($tmp);

    $data = json_decode((string)$response, true);
    $detail = is_array($data) && !empty($data['error']['message']) ? $data['error']['message'] : trim((string)$response);
    error_log('[SITECLASS DRIVE] chunk: http=' . $code . ' id=' . $uploadId . ' start=' . $start . ' end=' . $end . ' total=' . $total . ($detail !== '' ? ' response=' . substr($detail, 0, 1000) : ''));

    if ($response === false || $error) throw new Exception('ارتباط با Google Drive: ' . $error);

    if ($code === 308) {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode(['success'=>true,'complete'=>false,'status'=>308], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($code >= 200 && $code < 300 && is_array($data) && !empty($data['id'])) {
        @unlink($sessionFile);
        jsonResponse(['success'=>true,'complete'=>true,'file'=>$data]);
    }

    throw new Exception('Google Drive HTTP ' . $code . ($detail !== '' ? ' - ' . $detail : ''));
} catch (Throwable $e) {
    if (isset($fp) && is_resource($fp)) fclose($fp);
    @unlink($tmp);
    error_log('[SITECLASS DRIVE] chunk exception: ' . $e->getMessage());
    jsonResponse(['error'=>'ارسال بخش فایل به Google Drive ناموفق بود: ' . $e->getMessage()], 502);
}
