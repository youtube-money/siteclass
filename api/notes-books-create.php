<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

$me = requireRole(['admin']);
$input = getJsonInput();

$title = trim($input['title'] ?? '');
$chapterCount = (int)($input['chapter_count'] ?? 0);

if (!$title || $chapterCount < 1 || $chapterCount > 30) {
    jsonResponse(['error' => 'اسم کتاب و تعداد پودمان معتبر (۱ تا ۳۰) لازمه'], 400);
}

$pdo = getDB();
$pdo->beginTransaction();

$stmt = $pdo->prepare('INSERT INTO books (title, created_by) VALUES (?, ?)');
$stmt->execute([$title, $me['id']]);
$bookId = $pdo->lastInsertId();

$chapterStmt = $pdo->prepare('INSERT INTO book_chapters (book_id, chapter_name, chapter_order) VALUES (?, ?, ?)');
for ($i = 1; $i <= $chapterCount; $i++) {
    $chapterStmt->execute([$bookId, "پودمان $i", $i]);
}

$pdo->commit();

jsonResponse(['success' => true, 'id' => $bookId]);
