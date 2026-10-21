<?php

namespace App\Modules\auth\Services;

use App\Modules\auth\Mail\OtpCodeMail;
use Illuminate\Support\Facades\Mail;

final class EmailOtpSender
{
    public function send(string $email, string $code, string $purpose): void
    {
        Mail::to($email)->send(new OtpCodeMail($code, $purpose, (int) config('auth.otp_ttl_minutes', 5)));
    }
}
