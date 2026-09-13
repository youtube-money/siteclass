<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

$me = requireLogin();
$input = getJsonInput();

$bookId = (int)($input['book_id'] ?? 0);
$chapterId = (int)($input['chapter_id'] ?? 0);
$noteType = $input['note_type'] ?? '';
$fileLink = trim($input['file_link'] ?? '');
$textContent = trim($input['text_content'] ?? '');

if (!$bookId || !$chapterId || !in_array($noteType, ['upload', 'created'], true)) {
    jsonResponse(['error' => 'اطلاعات ناقصه'], 400);
}
if ($noteType === 'upload' && !$fileLink) {
    jsonResponse(['error' => 'لینک فایل لازمه'], 400);
}
if ($noteType === 'created' && !$textContent) {
    jsonResponse(['error' => 'متن جزوه لازمه'], 400);
}

$pdo = getDB();
$stmt = $pdo->prepare(
    'INSERT INTO notes (book_id, chapter_id, uploader_id, note_type, file_link, text_content)
     VALUES (?, ?, ?, ?, ?, ?)'
);
$stmt->execute([$bookId, $chapterId, $me['id'], $noteType, $fileLink ?: null, $textContent ?: null]);

jsonResponse(['success' => true, 'id' => $pdo->lastInsertId()]);
