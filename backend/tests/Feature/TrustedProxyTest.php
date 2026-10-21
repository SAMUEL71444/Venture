<?php

use Illuminate\Support\Facades\Route;

beforeEach(function () {
    Route::get('/_test/proxy-info', fn (\Illuminate\Http\Request $request) => [
        'ip' => $request->ip(),
        'secure' => $request->isSecure(),
    ]);
});

it('ignores forwarded headers when no proxy is trusted', function () {
    config(['trustedproxy.proxies' => null]);

    $this->getJson('/_test/proxy-info', ['X-Forwarded-For' => '203.0.113.7', 'X-Forwarded-Proto' => 'https'])
        ->assertOk()
        ->assertJson(['ip' => '127.0.0.1', 'secure' => false]);
});

it('uses the client ip and https scheme from the proxy when TRUSTED_PROXIES is *', function () {
    config(['trustedproxy.proxies' => '*']);

    $this->getJson('/_test/proxy-info', ['X-Forwarded-For' => '203.0.113.7', 'X-Forwarded-Proto' => 'https'])
        ->assertOk()
        ->assertJson(['ip' => '203.0.113.7', 'secure' => true]);
});

it('reads the trusted proxy list from the TRUSTED_PROXIES env variable', function () {
    $config = require config_path('trustedproxy.php');

    expect($config)->toHaveKey('proxies');
});
