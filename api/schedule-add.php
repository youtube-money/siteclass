<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

$me = requireLogin();
if ($me['role'] !== 'admin') {
    jsonResponse(['error' => 'فقط ادمین می‌تونه برنامه رو ویرایش کنه'], 403);
}

$input = getJsonInput();
$day = trim($input['day_of_week'] ?? '');
$subject = trim($input['subject'] ?? '');
$timeSlot = trim($input['time_slot'] ?? '');
$note = trim($input['note'] ?? '');

if (!$day || !$subject) {
    jsonResponse(['error' => 'روز و درس الزامیه'], 400);
}

$pdo = getDB();
$stmt = $pdo->prepare(
    'INSERT INTO schedule (day_of_week, subject, time_slot, note, created_by) VALUES (?, ?, ?, ?, ?)'
);
$stmt->execute([$day, $subject, $timeSlot ?: null, $note ?: null, $me['id']]);

jsonResponse(['success' => true, 'id' => $pdo->lastInsertId()]);
