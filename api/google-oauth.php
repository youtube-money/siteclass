<?php
require_once __DIR__ . '/config.php';

function googleOAuthTokenPath(): string {
    $dir = dirname(__DIR__) . '/.sessions';
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    if (is_dir($dir)) {
        @chmod($dir, 0700);
        if (!file_exists($dir . '/.htaccess')) @file_put_contents($dir . '/.htaccess', "Require all denied\nDeny from all\n");
    }
    return $dir . '/google-drive-oauth.json';
}

function googleOAuthConfigured(): bool {
    return defined('GOOGLE_OAUTH_CLIENT_ID') && defined('GOOGLE_OAUTH_CLIENT_SECRET') && defined('GOOGLE_OAUTH_REDIRECT_URI')
        && GOOGLE_OAUTH_CLIENT_ID !== '' && GOOGLE_OAUTH_CLIENT_SECRET !== '' && GOOGLE_OAUTH_REDIRECT_URI !== '';
}

function googleOAuthGetAccessToken(): string {
    if (!googleOAuthConfigured()) throw new Exception('تنظیمات Google OAuth در config.php کامل نیست.');
    $path = googleOAuthTokenPath();
    if (!is_file($path)) throw new Exception('Google Drive هنوز به سایت وصل نشده. اول اتصال Google Drive را انجام بده.');
    $token = json_decode((string)file_get_contents($path), true);
    if (!is_array($token) || empty($token['refresh_token'])) throw new Exception('Refresh Token گوگل پیدا نشد. دوباره Google Drive را وصل کن.');
    $expiresAt = (int)($token['created_at'] ?? 0) + (int)($token['expires_in'] ?? 0) - 60;
    if (!empty($token['access_token']) && time() < $expiresAt) return $token['access_token'];

    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query([
            'client_id' => GOOGLE_OAUTH_CLIENT_ID,
            'client_secret' => GOOGLE_OAUTH_CLIENT_SECRET,
            'refresh_token' => $token['refresh_token'],
            'grant_type' => 'refresh_token',
        ]),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
    ]);
    $response = curl_exec($ch); $error = curl_error($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    $data = json_decode((string)$response, true);
    if ($response === false || $error || $code < 200 || $code >= 300 || empty($data['access_token'])) {
        $oauthError = (string)($data['error'] ?? '');
        $description = (string)($data['error_description'] ?? $error ?: $response);
        if ($oauthError === 'invalid_grant') {
            @unlink($path);
            throw new Exception('اتصال Google Drive منقضی یا لغو شده است. باید دوباره Google Drive را متصل کنی.');
        }
        throw new Exception('تازه‌سازی دسترسی Google Drive ناموفق بود: ' . $description);
    }
    $token['access_token'] = $data['access_token'];
    $token['expires_in'] = (int)($data['expires_in'] ?? 3600);
    $token['created_at'] = time();
    @file_put_contents($path, json_encode($token, JSON_UNESCAPED_SLASHES), LOCK_EX);
    @chmod($path, 0600);
    return $token['access_token'];
}

function googleOAuthSaveToken(array $token): void {
    $path = googleOAuthTokenPath();
    $existing = is_file($path) ? json_decode((string)file_get_contents($path), true) : [];
    if (!is_array($existing)) $existing = [];
    if (empty($token['refresh_token']) && !empty($existing['refresh_token'])) $token['refresh_token'] = $existing['refresh_token'];
    $token['created_at'] = time();
    file_put_contents($path, json_encode($token, JSON_UNESCAPED_SLASHES), LOCK_EX);
    @chmod($path, 0600);
}
