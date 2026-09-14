<?php
require_once __DIR__ . '/session-helper.php';
require_once __DIR__ . '/google-oauth.php';

startSecureSession();
if (!googleOAuthConfigured()) { http_response_code(500); exit('تنظیمات Google OAuth در config.php کامل نیست.'); }

if (!empty($_GET['error'])) exit('اتصال Google Drive لغو شد: ' . htmlspecialchars((string)$_GET['error'], ENT_QUOTES, 'UTF-8'));
$state = (string)($_GET['state'] ?? '');
$expected = (string)($_SESSION['google_drive_oauth_state'] ?? '');
$expires = (int)($_SESSION['google_drive_oauth_state_expires'] ?? 0);
if ($state === '' || $expected === '' || !hash_equals($expected, $state) || time() > $expires) {
    http_response_code(400); exit('درخواست اتصال Google Drive نامعتبر یا منقضی شده. دوباره شروع کن.');
}
unset($_SESSION['google_drive_oauth_state'], $_SESSION['google_drive_oauth_state_expires']);

$code = (string)($_GET['code'] ?? '');
if ($code === '') { http_response_code(400); exit('کد اتصال Google دریافت نشد.'); }

$ch = curl_init('https://oauth2.googleapis.com/token');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => http_build_query([
        'code' => $code,
        'client_id' => GOOGLE_OAUTH_CLIENT_ID,
        'client_secret' => GOOGLE_OAUTH_CLIENT_SECRET,
        'redirect_uri' => GOOGLE_OAUTH_REDIRECT_URI,
        'grant_type' => 'authorization_code',
    ]),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 30,
]);
$response = curl_exec($ch); $error = curl_error($ch); $http = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
$data = json_decode((string)$response, true);
if ($response === false || $error || $http < 200 || $http >= 300 || empty($data['access_token'])) {
    http_response_code(502); exit('دریافت دسترسی Google ناموفق بود: ' . htmlspecialchars((string)($data['error_description'] ?? $error ?: $response), ENT_QUOTES, 'UTF-8'));
}

try {
    googleOAuthSaveToken($data);
    header('Location: /uploads.html?drive=connected');
    exit;
} catch (Throwable $e) {
    http_response_code(500); exit('ذخیره دسترسی Google ناموفق بود.');
}
