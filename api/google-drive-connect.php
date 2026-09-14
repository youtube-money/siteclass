<?php
require_once __DIR__ . '/session-helper.php';
require_once __DIR__ . '/google-oauth.php';

$me = requireLogin();
if ($me['role'] !== 'admin') { http_response_code(403); exit('دسترسی نداری'); }
if (!googleOAuthConfigured()) { http_response_code(500); exit('تنظیمات Google OAuth در config.php کامل نیست.'); }

startSecureSession();
$state = bin2hex(random_bytes(24));
$_SESSION['google_drive_oauth_state'] = $state;
$_SESSION['google_drive_oauth_state_expires'] = time() + 600;

$params = [
    'client_id' => GOOGLE_OAUTH_CLIENT_ID,
    'redirect_uri' => GOOGLE_OAUTH_REDIRECT_URI,
    'response_type' => 'code',
    'scope' => 'https://www.googleapis.com/auth/drive',
    'access_type' => 'offline',
    'prompt' => 'consent',
    'state' => $state,
];
header('Cache-Control: no-store');
header('Location: https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query($params));
exit;
