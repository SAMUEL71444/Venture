<?php

use App\Models\MentorProfile;
use App\Models\StudentProfile;
use App\Models\UmkmProfile;

/** Muat ulang config/database.php dengan env sementara, lalu kembalikan env semula. */
function pgsqlConfigWith(array $env): array
{
    $keys = ['DB_URL', 'DB_HOST', 'DB_SSLMODE'];
    $saved = [];
    foreach ($keys as $key) {
        $saved[$key] = [$_SERVER[$key] ?? null, $_ENV[$key] ?? null, getenv($key)];
        unset($_SERVER[$key], $_ENV[$key]);
        putenv($key);
        if (array_key_exists($key, $env)) {
            $_SERVER[$key] = $_ENV[$key] = $env[$key];
            putenv("{$key}={$env[$key]}");
        }
    }

    try {
        $config = require config_path('database.php');

        return (new Illuminate\Support\ConfigurationUrlParser)->parseConfiguration($config['connections']['pgsql']);
    } finally {
        foreach ($saved as $key => [$server, $envValue, $putenv]) {
            unset($_SERVER[$key], $_ENV[$key]);
            putenv($key);
            if ($server !== null) {
                $_SERVER[$key] = $server;
            }
            if ($envValue !== null) {
                $_ENV[$key] = $envValue;
            }
            if ($putenv !== false) {
                putenv("{$key}={$putenv}");
            }
        }
    }
}

it('uses prefer for local hosts and require for remote hosts', function () {
    expect(pgsqlConfigWith([])['sslmode'])->toBe('prefer')
        ->and(pgsqlConfigWith(['DB_HOST' => 'localhost'])['sslmode'])->toBe('prefer')
        ->and(pgsqlConfigWith(['DB_HOST' => 'ep-example.ap-southeast-1.aws.neon.tech'])['sslmode'])->toBe('require')
        ->and(pgsqlConfigWith(['DB_URL' => 'postgresql://u:p@ep-example.neon.tech/db'])['sslmode'])->toBe('require');
});

it('lets DB_SSLMODE and the sslmode in DB_URL override the default', function () {
    expect(pgsqlConfigWith(['DB_HOST' => 'ep-example.neon.tech', 'DB_SSLMODE' => 'verify-full'])['sslmode'])->toBe('verify-full')
        ->and(pgsqlConfigWith(['DB_URL' => 'postgresql://u:p@127.0.0.1/db?sslmode=require'])['sslmode'])->toBe('require')
        ->and(pgsqlConfigWith(['DB_URL' => 'postgresql://u:p@ep-example.neon.tech/db?sslmode=disable'])['sslmode'])->toBe('disable');
});

it('returns decimal profile columns as numbers even when the driver gives strings (pgsql)', function () {
    $student = (new StudentProfile)->setRawAttributes(['rating_avg' => '4.50']);
    $mentor = (new MentorProfile)->setRawAttributes(['rating_avg' => '3.25']);
    $umkm = (new UmkmProfile)->setRawAttributes(['latitude' => '-6.2000000', 'longitude' => '106.8166667', 'rating_avg' => '5.00']);

    expect($student->toArray()['rating_avg'])->toBe(4.5)
        ->and($mentor->toArray()['rating_avg'])->toBe(3.25)
        ->and($umkm->toArray())->toMatchArray(['latitude' => -6.2, 'longitude' => 106.8166667, 'rating_avg' => 5.0]);
});
