<?php

namespace App\Support\Demo;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/** Penanda data demo: semua akun demo memakai email berdomain @demo.digitalin.test. */
final class DemoAccounts
{
    public const DOMAIN = 'demo.digitalin.test';

    public static function email(string $localPart): string
    {
        return $localPart.'@'.self::DOMAIN;
    }

    /** @return Builder<User> */
    public static function query(): Builder
    {
        return User::query()->where('email', 'like', '%@'.self::DOMAIN);
    }

    public static function exist(): bool
    {
        return self::query()->exists();
    }
}
