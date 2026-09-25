<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

requireLogin();

$pdo = getDB();

/*
 * Keep posts visible even if an old/deleted user record no longer exists.
 * The previous INNER JOIN made the entire feed look empty in that case.
 */
$stmt = $pdo->query(
    'SELECT p.*, u.display_name, u.avatar_emoji
     FROM social_posts p
     LEFT JOIN users u ON u.id = p.user_id
     ORDER BY p.id DESC LIMIT 100'
);

$posts = [];
foreach ($stmt->fetchAll() as $post) {
    $post['display_name'] = $post['display_name'] ?: 'دانش‌آموز';
    $post['avatar_emoji'] = $post['avatar_emoji'] ?: '👤';
    $post['media_url'] = null;
    $post['media_type'] = null;

    $rawContent = (string)($post['content'] ?? '');

    if (preg_match('/^__SCMEDIA__([A-Za-z0-9+\/=]+)__ENDSCMEDIA__\s*/', $rawContent, $matches)) {
        $meta = json_decode(base64_decode($matches[1]), true);
        if (is_array($meta) && !empty($meta['url'])) {
            $post['media_url'] = $meta['url'];
            $post['media_type'] = $meta['type'] ?? null;

            // Normalize old Google Drive URLs to the site proxy.
            if (preg_match('~drive\.google\.com/(?:uc\?[^#]*id=|file/d/)([A-Za-z0-9_-]+)~', $post['media_url'], $idMatch)) {
                $post['media_url'] = '/api/google-file.php?id=' . rawurlencode($idMatch[1]);
            }
        }
        $post['content'] = preg_replace('/^__SCMEDIA__[A-Za-z0-9+\/=]+__ENDSCMEDIA__\s*/', '', $rawContent);
    }

    $posts[] = $post;
}

jsonResponse(['posts' => $posts]);
