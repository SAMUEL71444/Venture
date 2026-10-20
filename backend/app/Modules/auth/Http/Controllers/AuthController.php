<?php

namespace App\Modules\auth\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\MentorProfile;
use App\Models\StudentProfile;
use App\Models\UmkmProfile;
use App\Models\University;
use App\Models\User;
use App\Modules\auth\Services\CampusEmailVerificationService;
use App\Modules\auth\Services\OtpService;
use App\Modules\auth\Services\RefreshTokenService;
use App\Modules\auth\State\UserStateMachine;
use App\Shared\Exceptions\BusinessRuleViolation;
use App\Shared\Http\ApiResponse;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

final class AuthController extends Controller
{
    public function sendOtp(Request $request, OtpService $otpService)
    {
        $input = $request->validate([
            'phone' => ['required', 'string', 'regex:/^\+[1-9][0-9]{7,14}$/'],
        ]);

        return ApiResponse::success($otpService->send($input['phone']), [], 202);
    }

    public function verifyOtp(Request $request, OtpService $otpService)
    {
        $input = $request->validate([
            'phone' => ['required', 'string', 'regex:/^\+[1-9][0-9]{7,14}$/'],
            'code' => ['required', 'digits:6'],
        ]);

        return ApiResponse::success($otpService->verify($input['phone'], $input['code']));
    }

    public function registerUmkm(
        Request $request,
        OtpService $otpService,
        RefreshTokenService $tokens,
        UserStateMachine $states,
    ) {
        $input = $request->validate([
            'business_name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'regex:/^\+[1-9][0-9]{7,14}$/', 'unique:users,phone'],
            'verification_token' => ['required', 'string', 'min:64'],
            'password' => ['required', 'string', 'min:8', 'max:128'],
            'business_type' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:2000'],
            'city' => ['nullable', 'string', 'max:120'],
            'instagram_url' => ['nullable', 'url', 'max:255'],
        ]);

        $result = DB::transaction(function () use ($input, $otpService, $tokens, $states) {
            $otpService->consumeRegistrationProof($input['phone'], $input['verification_token']);

            $user = User::query()->create([
                'name' => $input['business_name'],
                'phone' => $input['phone'],
                'password_hash' => $input['password'],
                'role' => 'UMKM',
                'status' => 'PENDING_VERIFICATION',
                'phone_verified_at' => now(),
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
        RefreshTokenService $tokens,
        CampusEmailVerificationService $emailVerification,
    ) {
        $request->merge([
            'email' => Str::lower(trim((string) $request->input('email'))),
            'campus_email' => $request->filled('campus_email')
                ? Str::lower(trim((string) $request->input('campus_email')))
                : null,
        ]);

        $input = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email:rfc', 'max:255', 'unique:users,email'],
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
                throw new BusinessRuleViolation('Campus email domain does not match the selected university.');
            }
        }

        $result = DB::transaction(function () use ($input, $tokens) {
            $user = User::query()->create([
                'name' => $input['name'],
                'email' => Str::lower($input['email']),
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

    public function registerMentor(Request $request, RefreshTokenService $tokens)
    {
        $request->merge([
            'email' => Str::lower(trim((string) $request->input('email'))),
        ]);

        $input = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email:rfc', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'max:128'],
            'title' => ['required', 'string', 'max:255'],
            'institution' => ['required', 'string', 'max:255'],
            'bio' => ['nullable', 'string', 'max:4000'],
        ]);

        $result = DB::transaction(function () use ($input, $tokens) {
            $user = User::query()->create([
                'name' => $input['name'],
                'email' => Str::lower($input['email']),
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

        if (! $user || ! Hash::check($input['password'], $user->password_hash) || $user->status === 'SUSPENDED') {
            throw new AuthenticationException('The provided credentials are invalid.');
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
