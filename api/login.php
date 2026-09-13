<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

startSecureSession();
$input = getJsonInput();

$username = trim($input['username'] ?? '');
$password = $input['password'] ?? '';

$pdo = getDB();
$stmt = $pdo->prepare('SELECT * FROM users WHERE username = ?');
$stmt->execute([$username]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    jsonResponse(['error' => 'نام کاربری یا رمز عبور اشتباهه'], 401);
}

// اطلاعات ورود روی سشن سرور ذخیره می‌شه (نه توکن قابل‌جعل توی مرورگر)
$_SESSION['user_id'] = (int)$user['id'];
$_SESSION['username'] = $user['username'];
$_SESSION['role'] = $user['role'];

jsonResponse([
    'user' => [
        'id' => (int)$user['id'],
        'username' => $user['username'],
        'display_name' => $user['display_name'],
        'role' => $user['role'],
    ],
]);
