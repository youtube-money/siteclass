<?php
require_once __DIR__ . '/config.php';

// ⚠️ فایل امنیتی — دست‌کاری این فایل می‌تونه امنیت ورود کاربرها رو خراب کنه.

function startSecureSession(): void {
    $sessionsDir = dirname(__DIR__) . '/.sessions';

    if (session_status() === PHP_SESSION_ACTIVE) {
        if (session_save_path() === $sessionsDir) {
            return;
        }
        @session_abort();
        header_remove('Set-Cookie');
    }

    if (session_status() === PHP_SESSION_NONE) {
        $sessionName = session_name();
        $cookieSessionId = $_COOKIE[$sessionName] ?? null;

        if (!is_dir($sessionsDir)) {
            @mkdir($sessionsDir, 0700, true);
        }

        if (is_dir($sessionsDir)) {
            $htaccessPath = $sessionsDir . '/.htaccess';
            if (!file_exists($htaccessPath)) {
                @file_put_contents($htaccessPath, "Require all denied\n");
            }
            $indexPath = $sessionsDir . '/index.php';
            if (!file_exists($indexPath)) {
                @file_put_contents($indexPath, "<?php http_response_code(403); exit;\n");
            }
            session_save_path($sessionsDir);
            ini_set('session.save_path', $sessionsDir);
        }

        ini_set('session.use_cookies', '1');
        ini_set('session.use_only_cookies', '1');
        ini_set('session.use_strict_mode', '1');

        $isHttps = !empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off';

        session_set_cookie_params([
            'lifetime' => 60 * 60 * 24 * 30, // ۳۰ روز
            'path' => '/',
            'httponly' => true,
            'samesite' => 'Lax',
            'secure' => $isHttps,
        ]);

        if (!empty($cookieSessionId) && is_string($cookieSessionId) && preg_match('/^[a-zA-Z0-9,-]{20,128}$/', $cookieSessionId)) {
            session_id($cookieSessionId);
        }

        session_start();
    }
}

function jsonResponse($data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// اگه کاربر لاگین نکرده باشه، خودش خطای ۴۰۱ برمی‌گردونه و اجرا رو متوقف می‌کنه
function requireLogin(): array {
    startSecureSession();
    if (!isset($_SESSION['user_id'])) {
        jsonResponse(['error' => 'وارد نشدی'], 401);
    }
    return [
        'id' => $_SESSION['user_id'],
        'username' => $_SESSION['username'],
        'role' => $_SESSION['role'],
    ];
}

function getJsonInput(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

// برای اندپوینت‌هایی که فقط نقش‌های خاص بهشون دسترسی دارن (مثلاً شبکهٔ اجتماعی: ['special','admin'])
function requireRole(array $allowedRoles): array {
    $me = requireLogin();
    if (!in_array($me['role'], $allowedRoles, true)) {
        jsonResponse(['error' => 'دسترسی نداری'], 403);
    }
    return $me;
}
