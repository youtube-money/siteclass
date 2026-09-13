<?php
require_once __DIR__ . '/api/session-helper.php';
startSecureSession();
header('Location: ' . (isset($_SESSION['user_id']) ? 'dashboard.html' : 'login.html'));
exit;
