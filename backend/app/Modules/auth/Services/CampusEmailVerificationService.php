<?php

namespace App\Modules\auth\Services;

use App\Models\StudentProfile;
use App\Modules\auth\Notifications\VerifyCampusEmailNotification;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;

final class CampusEmailVerificationService
{
    public function send(StudentProfile $profile): void
    {
        Notification::route('mail', $profile->campus_email)
            ->notify(new VerifyCampusEmailNotification($this->verificationUrl($profile)));
    }

    /**
     * Tanda tangan RELATIF (path + query): tetap valid apa pun host/skema yang dilihat backend
     * (TLS di Render, proxy Next.js, tunnel). Host tautan di email:
     * - deploy normal: APP_URL (pasti, tidak terpengaruh header Host dari klien);
     * - mode demo laptop (LINKS_USE_REQUEST_HOST=true): host publik request ini, dari
     *   X-Forwarded-Host/-Proto yang dipercaya lewat TRUSTED_PROXIES (URL tunnel berganti tiap sesi).
     */
    public function verificationUrl(StudentProfile $profile): string
    {
        $path = URL::temporarySignedRoute(
            'auth.email.verify',
            now()->addMinutes((int) config('auth.email_verification_ttl_minutes', 60)),
            [
                'profile' => $profile->id,
                'hash' => sha1($profile->campus_email),
            ],
            absolute: false,
        );

        $root = config('app.links_use_request_host') ? URL::to('/') : (string) config('app.url');

        return rtrim($root, '/').$path;
    }
}
