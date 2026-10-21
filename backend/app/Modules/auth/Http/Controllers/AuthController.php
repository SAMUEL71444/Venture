<?php

namespace App\Modules\auth\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\MentorProfile;
use App\Models\StudentProfile;
use App\Models\UmkmProfile;
use App\Models\University;
use App\Models\User;
use App\Modules\auth\Http\Controllers\Concerns\ResolvesOtpTarget;
use App\Modules\auth\Services\CampusEmailVerificationService;
use App\Modules\auth\Services\OtpService;
use App\Modules\auth\Services\RefreshTokenService;
use App\Modules\auth\State\UserStateMachine;
use App\Shared\Exceptions\BusinessRuleViolation;
use App\Shared\Http\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

final class AuthController extends Controller
{
    use ResolvesOtpTarget;

    public function sendOtp(Request $request, OtpService $otpService)
    {
        [$channel, $identifier] = $this->validateOtpTarget($request);

        return ApiResponse::success($otpService->send($identifier, $channel), [], 202);
    }

    public function verifyOtp(Request $request, OtpService $otpService)
    {
        [$channel, $identifier, $input] = $this->validateOtpTarget($request, [
            'code' => ['required', 'digits:6'],
        ]);

        return ApiResponse::success($otpService->verify($identifier, $input['code'], $channel));
    }

    public function registerUmkm(
        Request $request,
        OtpService $otpService,
        RefreshTokenService $tokens,
        UserStateMachine $states,
    ) {
        $input = $request->validate([
            'business_name' => ['required', 'string', 'max:255'],
            ...$this->contactRules($request),
            'password' => ['required', 'string', 'min:8', 'max:128'],
            'business_type' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:2000'],
            'city' => ['nullable', 'string', 'max:120'],
            'instagram_url' => ['nullable', 'url', 'max:255'],
        ]);

        $result = DB::transaction(function () use ($input, $otpService, $tokens, $states) {
            $this->consumeContactProof($otpService, $input);

            $user = User::query()->create([
                'name' => $input['business_name'],
                ...$this->contactAttributes($input),
                'password_hash' => $input['password'],
                'role' => 'UMKM',
                'status' => 'PENDING_VERIFICATION',
            ]);
            $states->transition($user, 'ACTIVE');
            $user->save();

            $profile = UmkmProfile::query()->create([
                'user_id' => $user->id,
                'business_name' => $input['business_name'],
                'business_type' => $input['business_type'] ?? null,
                'address' => $input['address'] ?? null,
                'city' => $input['city'] ?? null,
                'instagram_url' => $input['instagram_url'] ?? null,
            ]);

            return [
                'user' => $user,
                'profile' => $profile,
                'tokens' => $tokens->issue($user),
            ];
        });

        return ApiResponse::success($this->registrationResponse($result), [], 201);
    }

    public function registerStudent(
        Request $request,
        OtpService $otpService,
        RefreshTokenService $tokens,
        CampusEmailVerificationService $emailVerification,
    ) {
        $request->merge([
            'campus_email' => $request->filled('campus_email')
                ? Str::lower(trim((string) $request->input('campus_email')))
                : null,
        ]);

        $input = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            ...$this->contactRules($request),
            'password' => ['required', 'string', 'min:8', 'max:128'],
            'university_id' => ['required', 'uuid', 'exists:universities,id'],
            'campus_email' => ['nullable', 'email:rfc', 'max:255', 'unique:student_profiles,campus_email'],
            'nim' => ['nullable', 'string', 'max:80'],
            'major' => ['nullable', 'string', 'max:255'],
            'semester' => ['nullable', 'integer', 'between:1,20'],
        ]);

        if (! empty($input['campus_email'])) {
            $university = University::query()->findOrFail($input['university_id']);
            $campusDomain = Str::lower(Str::afterLast($input['campus_email'], '@'));

            if (! hash_equals(Str::lower($university->email_domain), $campusDomain)) {
                throw new BusinessRuleViolation('Campus email domain does not match the selected university.', [], 'CAMPUS_EMAIL_DOMAIN_MISMATCH');
            }
        }

        $result = DB::transaction(function () use ($input, $otpService, $tokens) {
            $this->consumeContactProof($otpService, $input);

            $user = User::query()->create([
                'name' => $input['name'],
                ...$this->contactAttributes($input),
                'password_hash' => $input['password'],
                'role' => 'STUDENT',
                'status' => 'PENDING_VERIFICATION',
            ]);

            $profile = StudentProfile::query()->create([
                'user_id' => $user->id,
                'university_id' => $input['university_id'],
                'campus_email' => isset($input['campus_email']) ? Str::lower($input['campus_email']) : null,
                'nim' => $input['nim'] ?? null,
                'major' => $input['major'] ?? null,
                'semester' => $input['semester'] ?? null,
            ]);

            return [
                'user' => $user,
                'profile' => $profile,
                'tokens' => $tokens->issue($user),
            ];
        });

        if ($result['profile']->campus_email) {
            $emailVerification->send($result['profile']);
        }

        return ApiResponse::success($this->registrationResponse($result), [], 201);
    }

    public function registerMentor(Request $request, OtpService $otpService, RefreshTokenService $tokens)
    {
        $input = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            ...$this->contactRules($request),
            'password' => ['required', 'string', 'min:8', 'max:128'],
            'title' => ['required', 'string', 'max:255'],
            'institution' => ['required', 'string', 'max:255'],
            'bio' => ['nullable', 'string', 'max:4000'],
        ]);

        $result = DB::transaction(function () use ($input, $otpService, $tokens) {
            $this->consumeContactProof($otpService, $input);

            $user = User::query()->create([
                'name' => $input['name'],
                ...$this->contactAttributes($input),
                'password_hash' => $input['password'],
                'role' => 'MENTOR',
                'status' => 'PENDING_VERIFICATION',
            ]);

            $profile = MentorProfile::query()->create([
                'user_id' => $user->id,
                'title' => $input['title'],
                'institution' => $input['institution'],
                'bio' => $input['bio'] ?? null,
            ]);

            return [
                'user' => $user,
                'profile' => $profile,
                'tokens' => $tokens->issue($user),
            ];
        });

        return ApiResponse::success($this->registrationResponse($result), [], 201);
    }

    public function login(Request $request, RefreshTokenService $tokens)
    {
        $input = $request->validate([
            'identifier' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string', 'max:128'],
        ]);

        $identifier = trim($input['identifier']);
        $user = User::query()
            ->where(filter_var($identifier, FILTER_VALIDATE_EMAIL) ? 'email' : 'phone',
                filter_var($identifier, FILTER_VALIDATE_EMAIL) ? Str::lower($identifier) : $identifier)
            ->first();

        // Akun tidak ada, password salah, dan akun ditangguhkan sengaja dijawab sama (anti-enumerasi).
        if (! $user || ! Hash::check($input['password'], $user->password_hash) || $user->status === 'SUSPENDED') {
            return ApiResponse::error('INVALID_CREDENTIALS', 'The provided credentials are invalid.', null, 401);
        }

        $user->forceFill(['last_login_at' => now()])->save();

        return ApiResponse::success([
            'user' => $this->userSummary($user),
            'tokens' => $tokens->issue($user),
        ]);
    }

    public function refresh(Request $request, RefreshTokenService $tokens)
    {
        $input = $request->validate(['refresh_token' => ['required', 'string', 'min:64']]);

        return ApiResponse::success($tokens->rotate($input['refresh_token']));
    }

    public function logout(Request $request, RefreshTokenService $tokens)
    {
        $input = $request->validate(['refresh_token' => ['required', 'string', 'min:64']]);
        $tokens->revoke($request->user(), $input['refresh_token']);

        return ApiResponse::success(['logged_out' => true]);
    }

    /**
     * Kontak registrasi: email ATAU nomor HP (minimal satu) + verification_token
     * dari OTP kanal tersebut. `channel` boleh dikosongkan bila hanya satu kontak diisi.
     */
    private function contactRules(Request $request): array
    {
        $email = $request->filled('email') ? Str::lower(trim((string) $request->input('email'))) : null;
        $phone = $request->filled('phone') ? trim((string) $request->input('phone')) : null;
        $channel = $request->input('channel') ?? match (true) {
            $phone !== null && $email === null => OtpService::CHANNEL_WHATSAPP,
            $email !== null && $phone === null => OtpService::CHANNEL_EMAIL,
            default => null,
        };
        $request->merge(['email' => $email, 'phone' => $phone, 'channel' => $channel]);

        return [
            'channel' => ['required', 'string', Rule::in(OtpService::CHANNELS)],
            'email' => ['nullable', 'required_if:channel,'.OtpService::CHANNEL_EMAIL, 'required_without:phone', 'email:rfc', 'max:255', 'unique:users,email'],
            'phone' => ['nullable', 'required_if:channel,'.OtpService::CHANNEL_WHATSAPP, 'string', 'regex:'.OtpService::PHONE_PATTERN, 'unique:users,phone'],
            'verification_token' => ['required', 'string', 'min:64'],
        ];
    }

    /** Token verifikasi sekali pakai, terikat ke kanal + identifier yang didaftarkan. */
    private function consumeContactProof(OtpService $otpService, array $input): void
    {
        $identifier = $input['channel'] === OtpService::CHANNEL_EMAIL ? $input['email'] : $input['phone'];
        $otpService->consumeRegistrationProof($identifier, $input['verification_token'], $input['channel']);
    }

    private function contactAttributes(array $input): array
    {
        return [
            'email' => $input['email'] ?? null,
            'phone' => $input['phone'] ?? null,
            'email_verified_at' => $input['channel'] === OtpService::CHANNEL_EMAIL ? now() : null,
            'phone_verified_at' => $input['channel'] === OtpService::CHANNEL_WHATSAPP ? now() : null,
        ];
    }

    private function registrationResponse(array $result): array
    {
        return [
            'user' => $this->userSummary($result['user']),
            'profile' => $result['profile'],
            'tokens' => $result['tokens'],
        ];
    }

    private function userSummary(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'role' => $user->role,
            'status' => $user->status,
            'email_verified_at' => $user->email_verified_at?->toIso8601String(),
            'phone_verified_at' => $user->phone_verified_at?->toIso8601String(),
        ];
    }
}
