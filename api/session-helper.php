<?php
require_once __DIR__ . '/config.php';

// Central session bootstrap. Keep this deliberately simple and deterministic:
// every request must use the same session name, cookie settings and writable store.
function startSecureSession(): void {
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    // Give this site its own cookie so another PHP app on the same domain/path
    // cannot overwrite PHPSESSID.
    session_name('SITECLASSSESSID');

    $sessionsDir = dirname(__DIR__) . '/.sessions';
    if (!is_dir($sessionsDir)) {
        @mkdir($sessionsDir, 0700, true);
    }

    // Prefer the site's private session directory. If the host refuses to make
    // it writable, use a site-specific directory under PHP's temp directory.
    if (is_dir($sessionsDir) && is_writable($sessionsDir)) {
        session_save_path($sessionsDir);
    } else {
        $fallbackDir = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'siteclass-sessions';
        if (!is_dir($fallbackDir)) {
            @mkdir($fallbackDir, 0700, true);
        }
        if (is_dir($fallbackDir) && is_writable($fallbackDir)) {
            session_save_path($fallbackDir);
        }
    }

    $isHttps = (!empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');

    ini_set('session.use_cookies', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_trans_sid', '0');
    ini_set('session.cookie_httponly', '1');
    ini_set('session.cookie_secure', $isHttps ? '1' : '0');
    ini_set('session.cookie_samesite', 'Lax');

    session_set_cookie_params([
        'lifetime' => 60 * 60 * 24 * 30,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => $isHttps,
    ]);

    // IMPORTANT: do not manually call session_id() from $_COOKIE here.
    // PHP itself reads the cookie and starts the matching session. Manually
    // restoring an old/foreign ID can make strict-mode sessions appear logged out.
    session_start();
}

function jsonResponse($data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function requireLogin(): array {
    startSecureSession();

    if (!isset($_SESSION['user_id'])) {
        jsonResponse(['error' => 'وارد نشدی'], 401);
    }

    return [
        'id' => (int)$_SESSION['user_id'],
        'username' => (string)($_SESSION['username'] ?? ''),
        'display_name' => (string)($_SESSION['display_name'] ?? $_SESSION['username'] ?? ''),
        'role' => (string)($_SESSION['role'] ?? 'student'),
    ];
}

function getJsonInput(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function requireRole(array $allowedRoles): array {
    $me = requireLogin();
    if (!in_array($me['role'], $allowedRoles, true)) {
        jsonResponse(['error' => 'دسترسی نداری'], 403);
    }
    return $me;
}
