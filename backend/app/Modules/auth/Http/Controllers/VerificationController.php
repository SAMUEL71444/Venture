<?php

namespace App\Modules\auth\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\MentorProfile;
use App\Models\StudentProfile;
use App\Models\User;
use App\Modules\auth\Services\CampusEmailVerificationService;
use App\Modules\auth\State\UserStateMachine;
use App\Modules\auth\State\VerificationStateMachine;
use App\Shared\Exceptions\BusinessRuleViolation;
use App\Shared\Exceptions\InvalidStateTransition;
use App\Shared\Http\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

final class VerificationController extends Controller
{
    /** Total pengajuan KTM (unggah pertama + unggah ulang setelah ditolak). */
    public const MAX_KTM_ATTEMPTS = 3;

    /** Disk privat file KTM (config filesystems.sensitive_disks.ktm; produksi: s3 = Supabase Storage). */
    public static function ktmDisk(): string
    {
        return (string) config('filesystems.sensitive_disks.ktm', 'private');
    }

    public function sendCampusEmailVerification(Request $request, CampusEmailVerificationService $service)
    {
        $profile = $request->user()->studentProfile;

        // Universitas di luar daftar / tanpa domain email kampus: verifikasi lewat unggah KTM.
        if ($profile && ! $profile->university?->email_domain) {
            throw new BusinessRuleViolation('Campus email verification is not available for this university. Upload your KTM instead.', ['verification_method' => 'KTM'], 'CAMPUS_EMAIL_NOT_AVAILABLE');
        }

        if (! $profile?->campus_email) {
            throw new BusinessRuleViolation('Campus email is not set for this student profile.', [], 'CAMPUS_EMAIL_NOT_SET');
        }

        if ($profile->campus_email_verified_at || $profile->verification_status !== 'PENDING') {
            throw new InvalidStateTransition('Campus email verification is not pending.');
        }

        $service->send($profile);

        return ApiResponse::success(['verification_email_sent' => true], [], 202);
    }

    public function verifyCampusEmail(
        Request $request,
        string $profile,
        string $hash,
        VerificationStateMachine $verificationStates,
        UserStateMachine $userStates,
    ) {
        $student = StudentProfile::query()->findOrFail($profile);

        if (! $student->campus_email || ! hash_equals(sha1($student->campus_email), $hash)) {
            abort(403);
        }

        DB::transaction(function () use ($request, $student, $verificationStates, $userStates) {
            $student = StudentProfile::query()->lockForUpdate()->findOrFail($student->id);
            $user = User::query()->lockForUpdate()->findOrFail($student->user_id);

            if ($student->campus_email_verified_at || $student->verification_status !== 'PENDING') {
                throw new InvalidStateTransition('Campus email verification is not pending.');
            }

            $before = [
                'verification_status' => $student->verification_status,
                'user_status' => $user->status,
            ];

            $verificationStates->transition($student, 'VERIFIED');
            $student->campus_email_verified_at = now();
            $student->save();

            $userStates->transition($user, 'ACTIVE');
            $user->save();

            $this->audit($request, $user, 'STUDENT_CAMPUS_EMAIL_VERIFIED', $student, $before, [
                'verification_status' => $student->verification_status,
                'user_status' => $user->status,
            ]);
        });

        return ApiResponse::success(['verified' => true]);
    }

    public function uploadKtm(Request $request, VerificationStateMachine $verificationStates)
    {
        $input = $request->validate([
            'ktm' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:5120'],
        ]);
        $student = $request->user()->studentProfile;

        $resubmission = $student?->verification_status === 'REJECTED';

        if (! $student || $student->campus_email_verified_at || ! in_array($student->verification_status, ['PENDING', 'REJECTED'], true)) {
            throw new BusinessRuleViolation('KTM verification is only available for students without verified campus email.', [], 'KTM_VERIFICATION_NOT_ALLOWED');
        }

        if ($resubmission && $student->verification_attempts >= self::MAX_KTM_ATTEMPTS) {
            throw new BusinessRuleViolation('Maximum number of KTM verification attempts reached. Contact support.', [
                'max_attempts' => self::MAX_KTM_ATTEMPTS,
                'attempts' => $student->verification_attempts,
            ], 'VERIFICATION_ATTEMPTS_EXCEEDED');
        }

        // Ditolak → pengajuan ulang kembali menunggu review (riwayat alasan tetap di audit log).
        $oldPath = $resubmission ? null : $student->ktm_file_url;
        $rejectedPath = $resubmission ? $student->ktm_file_url : null;
        if ($resubmission) {
            $verificationStates->transition($student, 'PENDING');
        }
        $extension = strtolower($input['ktm']->extension());
        $path = $input['ktm']->storeAs(
            "verification/ktm/{$student->user_id}",
            Str::uuid().".{$extension}",
            self::ktmDisk(),
        );

        // Unggahan pertama = satu pengajuan; mengganti file selama masih menunggu review tidak menambah hitungan.
        if (! $oldPath) {
            $student->verification_attempts = $student->verification_attempts + 1;
        }
        $student->ktm_file_url = $path;
        $student->ktm_submitted_at = now();
        $student->save();

        foreach (array_filter([$oldPath, $rejectedPath]) as $previous) {
            Storage::disk(self::ktmDisk())->delete($previous);
        }

        return ApiResponse::success(['verification_status' => $student->verification_status], [], 202);
    }

    public function index(Request $request)
    {
        $students = StudentProfile::query()
            ->where('verification_status', 'PENDING')
            ->whereNotNull('ktm_file_url')
            ->with(['user:id,name,email,role', 'university:id,name'])
            ->get()
            ->map(fn (StudentProfile $profile) => [
                'id' => $profile->id,
                'type' => 'STUDENT_KTM',
                'verification_status' => $profile->verification_status,
                'user' => $profile->user,
                'university_id' => $profile->university_id,
                'university_name' => $profile->university?->name,
                'university_name_custom' => $profile->university_name_custom,
                'method' => 'KTM',
                'submitted_at' => ($profile->ktm_submitted_at ?? $profile->updated_at)?->toIso8601String(),
                'attempts' => max(1, (int) $profile->verification_attempts),
                'created_at' => $profile->created_at,
            ]);

        $mentors = MentorProfile::query()
            ->where('verification_status', 'PENDING')
            ->with('user:id,name,email,role')
            ->get()
            ->map(fn (MentorProfile $profile) => [
                'id' => $profile->id,
                'type' => 'MENTOR',
                'verification_status' => $profile->verification_status,
                'user' => $profile->user,
                'method' => 'MENTOR_REVIEW',
                'submitted_at' => $profile->created_at?->toIso8601String(),
                'attempts' => 1,
                'created_at' => $profile->created_at,
            ]);

        return ApiResponse::success($students->concat($mentors)->sortBy('created_at')->values());
    }

    public function downloadKtm(StudentProfile $student)
    {
        abort_unless($student->ktm_file_url, 404);
        $path = $student->ktm_file_url;

        abort_if(str_contains($path, '..') || str_starts_with($path, '/'), 404);
        abort_unless(Storage::disk(self::ktmDisk())->exists($path), 404);

        return response()->streamDownload(function () use ($path) {
            $stream = Storage::disk(self::ktmDisk())->readStream($path);

            if ($stream === false) {
                abort(404);
            }

            fpassthru($stream);
            fclose($stream);
        }, "ktm-{$student->id}.".pathinfo($path, PATHINFO_EXTENSION));
    }

    public function decide(
        Request $request,
        string $id,
        string $decision,
        VerificationStateMachine $verificationStates,
        UserStateMachine $userStates,
    ) {
        abort_unless(in_array($decision, ['approve', 'reject'], true), 404);
        $input = $request->validate([
            'type' => ['required', 'in:STUDENT_KTM,MENTOR'],
            'reason' => [$decision === 'reject' ? 'required' : 'nullable', 'string', 'max:2000'],
        ]);
        $request->attributes->set('decision_reason', $input['reason'] ?? null);

        if ($input['type'] === 'STUDENT_KTM') {
            return $this->decideStudent($request, StudentProfile::query()->findOrFail($id), $decision, $verificationStates, $userStates);
        }

        return $this->decideMentor($request, MentorProfile::query()->findOrFail($id), $decision, $verificationStates, $userStates);
    }

    public function decideStudent(
        Request $request,
        StudentProfile $student,
        string $decision,
        VerificationStateMachine $verificationStates,
        UserStateMachine $userStates,
    ) {
        abort_unless(in_array($decision, ['approve', 'reject'], true), 404);
        $input = ['reason' => $request->attributes->get('decision_reason')];

        DB::transaction(function () use ($request, $student, $decision, $input, $verificationStates, $userStates) {
            $student = StudentProfile::query()->lockForUpdate()->findOrFail($student->id);
            $user = User::query()->lockForUpdate()->findOrFail($student->user_id);

            if (! $student->ktm_file_url || $student->campus_email_verified_at) {
                throw new BusinessRuleViolation('This student does not have a pending KTM verification.', [], 'KTM_VERIFICATION_NOT_PENDING');
            }

            $target = $decision === 'approve' ? 'VERIFIED' : 'REJECTED';
            $before = ['verification_status' => $student->verification_status, 'user_status' => $user->status];

            $verificationStates->transition($student, $target);
            $student->verified_by = $request->user()->id;
            $student->save();

            if ($decision === 'approve') {
                $userStates->transition($user, 'ACTIVE');
                $user->save();
            }

            $this->audit($request, $request->user(), "STUDENT_KTM_{$decision}", $student, $before, [
                'verification_status' => $student->verification_status,
                'user_status' => $user->status,
                'reason' => $input['reason'] ?? null,
            ]);
        });

        return ApiResponse::success(['verification_status' => $decision === 'approve' ? 'VERIFIED' : 'REJECTED']);
    }

    public function decideMentor(
        Request $request,
        MentorProfile $mentor,
        string $decision,
        VerificationStateMachine $verificationStates,
        UserStateMachine $userStates,
    ) {
        abort_unless(in_array($decision, ['approve', 'reject'], true), 404);
        $input = ['reason' => $request->attributes->get('decision_reason')];

        DB::transaction(function () use ($request, $mentor, $decision, $input, $verificationStates, $userStates) {
            $mentor = MentorProfile::query()->lockForUpdate()->findOrFail($mentor->id);
            $user = User::query()->lockForUpdate()->findOrFail($mentor->user_id);
            $target = $decision === 'approve' ? 'VERIFIED' : 'REJECTED';
            $before = ['verification_status' => $mentor->verification_status, 'user_status' => $user->status];

            $verificationStates->transition($mentor, $target);
            $mentor->save();

            if ($decision === 'approve') {
                $userStates->transition($user, 'ACTIVE');
                $user->save();
            }

            $this->audit($request, $request->user(), "MENTOR_{$decision}", $mentor, $before, [
                'verification_status' => $mentor->verification_status,
                'user_status' => $user->status,
                'reason' => $input['reason'] ?? null,
            ]);
        });

        return ApiResponse::success(['verification_status' => $decision === 'approve' ? 'VERIFIED' : 'REJECTED']);
    }

    private function audit(Request $request, $actor, string $action, $entity, array $before, array $after): void
    {
        AuditLog::query()->create([
            'actor_id' => $actor->id,
            'action' => $action,
            'entity_type' => $entity::class,
            'entity_id' => $entity->id,
            'before_data' => $before,
            'after_data' => $after,
            'ip_address' => $request->ip(),
        ]);
    }
}
