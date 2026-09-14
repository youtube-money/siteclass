<?php
require_once __DIR__ . '/config.php';

// Central session bootstrap. Keep this deterministic: every request uses the
// same cookie name, cookie settings and writable session store.
function startSecureSession(): void {
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    // Isolate this site's session cookie from other PHP apps on the same domain.
    session_name('SITECLASSSESSID');

    $sessionsDir = dirname(__DIR__) . '/.sessions';
    if (!is_dir($sessionsDir)) {
        @mkdir($sessionsDir, 0700, true);
    }

    // Always protect the directory, including when cPanel created it during deployment.
    if (is_dir($sessionsDir)) {
        @chmod($sessionsDir, 0700);
        $htaccessPath = $sessionsDir . '/.htaccess';
        if (!file_exists($htaccessPath)) {
            @file_put_contents($htaccessPath, "Require all denied\nDeny from all\n");
        }
        $indexPath = $sessionsDir . '/index.php';
        if (!file_exists($indexPath)) {
            @file_put_contents($indexPath, "<?php http_response_code(403); exit;\n");
        }
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
        if (is_dir($fallbackDir)) {
            @chmod($fallbackDir, 0700);
        }
        if (is_dir($fallbackDir) && is_writable($fallbackDir)) {
            session_save_path($fallbackDir);
        }
    }

    // IMPORTANT: decide Secure from the actual PHP HTTPS flag only.
    // Some cPanel/proxy layers send X-Forwarded-Proto=https even when the
    // browser is visiting the site over plain HTTP. In that situation a Secure
    // cookie is accepted by the browser but is NOT sent back over HTTP, which
    // produces exactly: login succeeds -> dashboard opens -> /api/me.php sees
    // no session -> redirect to login.
    $isHttps = !empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off';

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

    // Do not manually pass $_COOKIE's session ID to session_id(). PHP already
    // restores the cookie. Manual restoration can conflict with strict mode and
    // make a valid login look logged out on the next request.
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
