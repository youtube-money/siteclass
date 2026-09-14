<?php
require_once __DIR__ . '/session-helper.php';

startSecureSession();
$_SESSION = [];
clearAuthCookie();

$params = session_get_cookie_params();
setcookie(session_name(), '', [
    'expires' => time() - 42000,
    'path' => $params['path'] ?? '/',
    'domain' => $params['domain'] ?? '',
    'secure' => (bool)($params['secure'] ?? false),
    'httponly' => (bool)($params['httponly'] ?? true),
    'samesite' => $params['samesite'] ?? 'Lax',
]);

session_destroy();
jsonResponse(['success' => true]);
