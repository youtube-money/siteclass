<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

$me = requireRole(['admin']);
$input = getJsonInput();

$label = trim($input['label'] ?? '');
$apiKey = trim($input['api_key'] ?? '');
$keyRole = $input['key_role'] ?? '';
$id = isset($input['id']) ? (int)$input['id'] : null;

if (!$label || strlen($apiKey) < 10) {
    jsonResponse(['error' => 'اسم مستعار و کلید معتبر لازمه'], 400);
}
if (!in_array($keyRole, ['assistant', 'chatbot', 'coding'], true)) {
    jsonResponse(['error' => 'نقش کلید نامعتبره'], 400);
}

$pdo = getDB();

// هر نقش فقط می‌تونه مال یه کلید باشه — اگه یه کلید دیگه همین نقش رو داره، خطا بده
$stmt = $pdo->prepare('SELECT id, label FROM site_api_keys WHERE key_role = ? AND id != ?');
$stmt->execute([$keyRole, $id ?: 0]);
$conflict = $stmt->fetch();
if ($conflict) {
    jsonResponse(['error' => "این نقش قبلاً به کلید «{$conflict['label']}» اختصاص داده شده. اول نقش اون رو عوض کن."], 400);
}

if (!$id) {
    $count = (int)$pdo->query('SELECT COUNT(*) c FROM site_api_keys')->fetch()['c'];
    if ($count >= 3) {
        jsonResponse(['error' => 'حداکثر ۳ کلید می‌تونی اضافه کنی'], 400);
    }
}

if ($id) {
    $stmt = $pdo->prepare('UPDATE site_api_keys SET label = ?, api_key = ?, key_role = ? WHERE id = ?');
    $stmt->execute([$label, $apiKey, $keyRole, $id]);
} else {
    $stmt = $pdo->prepare('INSERT INTO site_api_keys (label, api_key, key_role) VALUES (?, ?, ?)');
    $stmt->execute([$label, $apiKey, $keyRole]);
}

jsonResponse(['success' => true]);
