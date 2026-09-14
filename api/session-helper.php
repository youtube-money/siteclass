<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

// Central authentication bootstrap. PHP sessions are kept for compatibility,
// but authentication also has a small signed cookie so login does not depend on
// local PHP session files (which can be unreliable on some cPanel setups).
function startSecureSession(): void {
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    session_name('SITECLASSSESSID');

    $sessionsDir = dirname(__DIR__) . '/.sessions';
    if (!is_dir($sessionsDir)) {
        @mkdir($sessionsDir, 0700, true);
    }

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

    session_start();
}

function authCookieIsHttps(): bool {
    return !empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off';
}

function base64UrlEncode(string $value): string {
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function base64UrlDecode(string $value): string|false {
    $padding = strlen($value) % 4;
    if ($padding) {
        $value .= str_repeat('=', 4 - $padding);
    }
    return base64_decode(strtr($value, '-_', '+/'), true);
}

function setAuthCookie(int $userId): void {
    $expires = time() + (60 * 60 * 24 * 30);
    $payload = $userId . '.' . $expires;
    $signature = hash_hmac('sha256', $payload, SESSION_SECRET);
    $value = base64UrlEncode($payload . '.' . $signature);

    setcookie('SITECLASS_AUTH', $value, [
        'expires' => $expires,
        'path' => '/',
        'secure' => authCookieIsHttps(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function clearAuthCookie(): void {
    setcookie('SITECLASS_AUTH', '', [
        'expires' => time() - 42000,
        'path' => '/',
        'secure' => authCookieIsHttps(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function getUserFromAuthCookie(): ?array {
    $raw = $_COOKIE['SITECLASS_AUTH'] ?? '';
    if ($raw === '') {
        return null;
    }

    $decoded = base64UrlDecode($raw);
    if ($decoded === false) {
        return null;
    }

    $parts = explode('.', $decoded);
    if (count($parts) !== 3) {
        return null;
    }

    [$userId, $expires, $signature] = $parts;
    if (!ctype_digit($userId) || !ctype_digit($expires) || (int)$expires < time()) {
        return null;
    }

    $payload = $userId . '.' . $expires;
    $expected = hash_hmac('sha256', $payload, SESSION_SECRET);
    if (!hash_equals($expected, $signature)) {
        return null;
    }

    $pdo = getDB();
    $stmt = $pdo->prepare('SELECT id, username, display_name, role FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([(int)$userId]);
    $user = $stmt->fetch();

    return $user ?: null;
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

    // Normal PHP session path.
    if (isset($_SESSION['user_id'])) {
        return [
            'id' => (int)$_SESSION['user_id'],
            'username' => (string)($_SESSION['username'] ?? ''),
            'display_name' => (string)($_SESSION['display_name'] ?? $_SESSION['username'] ?? ''),
            'role' => (string)($_SESSION['role'] ?? 'student'),
        ];
    }

    // Fallback path: signed auth cookie survives broken/non-persistent PHP sessions.
    $user = getUserFromAuthCookie();
    if ($user) {
        $_SESSION['user_id'] = (int)$user['id'];
        $_SESSION['username'] = $user['username'];
        $_SESSION['display_name'] = $user['display_name'];
        $_SESSION['role'] = $user['role'];

        return [
            'id' => (int)$user['id'],
            'username' => (string)$user['username'],
            'display_name' => (string)$user['display_name'],
            'role' => (string)$user['role'],
        ];
    }

    jsonResponse(['error' => 'وارد نشدی'], 401);
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
