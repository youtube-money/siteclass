<?php
require_once __DIR__ . '/config.php';

// ⚠️ فایل امنیتی — دست‌کاری این فایل می‌تونه امنیت ورود کاربرها رو خراب کنه.

function startSecureSession(): void {
    if (session_status() === PHP_SESSION_NONE) {
        session_set_cookie_params([
            'lifetime' => 60 * 60 * 24 * 30, // ۳۰ روز
            'path' => '/',
            'httponly' => true,
            'samesite' => 'Lax',
            'secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        ]);
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
