<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

startSecureSession();
$input = getJsonInput();

$username = trim($input['username'] ?? '');
$password = $input['password'] ?? '';

if ($username === '' || $password === '') {
    jsonResponse(['error' => 'نام کاربری و رمز عبور رو وارد کن'], 400);
}

$pdo = getDB();
$stmt = $pdo->prepare('SELECT * FROM users WHERE username = ?');
$stmt->execute([$username]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    jsonResponse(['error' => 'نام کاربری یا رمز عبور اشتباهه'], 401);
}

if (!session_regenerate_id(true)) {
    jsonResponse(['error' => 'خطا در ساخت نشست ورود؛ دوباره تلاش کن'], 500);
}

$_SESSION['user_id'] = (int)$user['id'];
$_SESSION['username'] = $user['username'];
$_SESSION['display_name'] = $user['display_name'];
$_SESSION['role'] = $user['role'];
$_SESSION['logged_in_at'] = time();

// Keep authentication alive even when cPanel/PHP does not persist local
// session files consistently between requests.
setAuthCookie((int)$user['id']);

jsonResponse([
    'user' => [
        'id' => (int)$user['id'],
        'username' => $user['username'],
        'display_name' => $user['display_name'],
        'role' => $user['role'],
    ],
]);
