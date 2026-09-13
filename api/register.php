<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

startSecureSession();
$input = getJsonInput();

$username = trim($input['username'] ?? '');
$displayName = trim($input['display_name'] ?? '');
$password = $input['password'] ?? '';

if (!$username || !$displayName || strlen($password) < 6) {
    jsonResponse(['error' => 'اطلاعات ناقص یا رمز عبور کوتاه‌تر از ۶ کاراکتره'], 400);
}

$pdo = getDB();

$stmt = $pdo->prepare('SELECT id FROM users WHERE username = ?');
$stmt->execute([$username]);
if ($stmt->fetch()) {
    jsonResponse(['error' => 'این نام کاربری قبلاً ثبت شده'], 409);
}

$hash = password_hash($password, PASSWORD_BCRYPT);
$stmt = $pdo->prepare('INSERT INTO users (username, display_name, password_hash, role) VALUES (?, ?, ?, ?)');
$stmt->execute([$username, $displayName, $hash, 'student']);

jsonResponse(['success' => true, 'userId' => $pdo->lastInsertId()]);
