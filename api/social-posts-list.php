<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

requireLogin();

$pdo = getDB();
$stmt = $pdo->query(
    'SELECT p.*, u.display_name, u.avatar_emoji FROM social_posts p
     JOIN users u ON u.id = p.user_id ORDER BY p.id DESC LIMIT 100'
);

$posts = [];
foreach ($stmt->fetchAll() as $post) {
    $post['media_url'] = null;
    $post['media_type'] = null;

    if (preg_match('/^__SCMEDIA__([A-Za-z0-9+\/=]+)__ENDSCMEDIA__\s*/', $post['content'], $matches)) {
        $meta = json_decode(base64_decode($matches[1]), true);
        if (is_array($meta) && !empty($meta['url'])) {
            $post['media_url'] = $meta['url'];
            $post['media_type'] = $meta['type'] ?? null;

            if (preg_match('~drive\.google\.com/(?:uc\?[^#]*id=|file/d/)([A-Za-z0-9_-]+)~', $post['media_url'], $idMatch)) {
                $post['media_url'] = '/api/google-file.php?id=' . rawurlencode($idMatch[1]);
            }
        }
        $post['content'] = preg_replace('/^__SCMEDIA__[A-Za-z0-9+\/=]+__ENDSCMEDIA__\s*/', '', $post['content']);
    }
    $posts[] = $post;
}

jsonResponse(['posts'=>$posts]);
