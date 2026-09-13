<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

requireLogin();

$pdo = getDB();
$books = $pdo->query('SELECT * FROM books ORDER BY id ASC')->fetchAll();

foreach ($books as &$book) {
    $stmt = $pdo->prepare('SELECT * FROM book_chapters WHERE book_id = ? ORDER BY chapter_order ASC');
    $stmt->execute([$book['id']]);
    $book['chapters'] = $stmt->fetchAll();

    foreach ($book['chapters'] as &$chapter) {
        $countStmt = $pdo->prepare('SELECT COUNT(*) c FROM notes WHERE chapter_id = ?');
        $countStmt->execute([$chapter['id']]);
        $chapter['note_count'] = (int)$countStmt->fetch()['c'];
    }
    unset($chapter);
}
unset($book);

jsonResponse(['books' => $books]);
