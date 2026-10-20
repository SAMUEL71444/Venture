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
        $url = URL::temporarySignedRoute(
            'auth.email.verify',
            now()->addMinutes((int) config('auth.email_verification_ttl_minutes', 60)),
            [
                'profile' => $profile->id,
                'hash' => sha1($profile->campus_email),
            ],
        );

        Notification::route('mail', $profile->campus_email)
            ->notify(new VerifyCampusEmailNotification($url));
    }
}
