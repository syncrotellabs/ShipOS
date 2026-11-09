<?php
/**
 * Plugin Name: ShipOS WordPress SSO
 * Description: Issues short-lived, signed ShipOS role assertions for logged-in Echoboard HQ members.
 * Version: 0.1.0
 * License: MIT
 */

defined('ABSPATH') || exit;

function shipos_sso_base64url($value) {
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function shipos_sso_home() {
    wp_safe_redirect(home_url('/'));
    exit;
}

function shipos_sso_issue() {
    if (!is_user_logged_in()) {
        shipos_sso_home();
    }
    $secret = defined('SHIPOS_SSO_SECRET') ? SHIPOS_SSO_SECRET : '';
    $callback = defined('SHIPOS_SSO_CALLBACK') ? SHIPOS_SSO_CALLBACK : 'https://shipos.echoboardhq.com/auth/callback';
    $state = isset($_GET['state']) ? sanitize_text_field(wp_unslash($_GET['state'])) : '';
    if (strlen($secret) < 32 || !preg_match('/^[A-Za-z0-9_-]{20,128}$/', $state) || wp_http_validate_url($callback) === false) {
        status_header(503);
        wp_die(esc_html__('ShipOS sign-in is not configured.', 'shipos-sso'));
    }
    $user = wp_get_current_user();
    $now = time();
    $payload = array(
        'sub' => (string) $user->ID,
        'name' => (string) $user->display_name,
        'role' => in_array('administrator', (array) $user->roles, true) ? 'admin' : 'viewer',
        'iat' => $now,
        'exp' => $now + 60,
        'jti' => shipos_sso_base64url(random_bytes(24)),
        'state' => $state,
    );
    $encoded = shipos_sso_base64url(wp_json_encode($payload));
    $signature = shipos_sso_base64url(hash_hmac('sha256', $encoded, $secret, true));
    $destination = add_query_arg('assertion', $encoded . '.' . $signature, $callback);
    wp_redirect(esc_url_raw($destination), 302, 'ShipOS');
    exit;
}

add_action('admin_post_shipos_sso', 'shipos_sso_issue');
add_action('admin_post_nopriv_shipos_sso', 'shipos_sso_home');
