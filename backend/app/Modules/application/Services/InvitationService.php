<?php

namespace App\Modules\application\Services;

use App\Models\Application;
use App\Models\Invitation;
use App\Models\Project;
use App\Models\StudentProfile;
use App\Models\User;
use App\Modules\application\State\InvitationStateMachine;
use App\Modules\chat\Services\ChatService;
use App\Modules\notification\Services\NotificationService;
use App\Modules\scheduler\Services\SchedulerPlanner;
use App\Shared\Database\TransactionRunner;
use App\Shared\Exceptions\BusinessRuleViolation;
use App\Shared\Exceptions\InvalidStateTransition;
use App\Shared\Settings\PlatformSettingsService;
use Illuminate\Auth\Access\AuthorizationException;

/** Undangan UMKM ke mahasiswa. Setelah diterima, mahasiswa mengirim lamaran seperti biasa. */
final class InvitationService
{
    public function __construct(
        private readonly TransactionRunner $transactions,
        private readonly InvitationStateMachine $invitations,
        private readonly ApplicationService $applications,
        private readonly PlatformSettingsService $settings,
        private readonly SchedulerPlanner $scheduler,
        private readonly NotificationService $notifications,
        private readonly ChatService $chat,
    ) {}

    public function invite(Project $project, User $umkm, string $studentUserId, ?string $message): Invitation
    {
        if ($project->umkm_id !== $umkm->id) {
            throw new AuthorizationException('Only the project owner can invite students.');
        }

        return $this->transactions->run(function () use ($project, $studentUserId, $message) {
            $project = Project::query()->lockForUpdate()->findOrFail($project->id);
            if ($project->status !== 'OPEN') {
                throw new InvalidStateTransition('Invitations can only be sent for OPEN projects.', ['status' => $project->status]);
            }

            $student = User::query()->find($studentUserId);
            $profile = StudentProfile::query()->where('user_id', $studentUserId)->first();
            if (! $student || $student->role !== 'STUDENT' || $student->status !== 'ACTIVE'
                || ! $profile || $profile->verification_status !== 'VERIFIED') {
                throw new BusinessRuleViolation('Only active, verified students can be invited.');
            }

            $pendingInvitation = Invitation::query()
                ->where('project_id', $project->id)
                ->where('student_id', $studentUserId)
                ->where('status', 'PENDING')
                ->where('expires_at', '>', now())
                ->exists();
            if ($pendingInvitation) {
                throw new BusinessRuleViolation('This student already has a pending invitation for this project.');
            }

            $hasApplication = Application::query()
                ->where('project_id', $project->id)
                ->where('student_id', $studentUserId)
                ->whereIn('status', ['PENDING', 'SHORTLISTED', 'ACCEPTED'])
                ->exists();
            if ($hasApplication) {
                throw new BusinessRuleViolation('This student has already applied to this project.');
            }

            $invitation = Invitation::query()->create([
                'project_id' => $project->id,
                'student_id' => $studentUserId,
                'message' => $message,
                'status' => 'PENDING',
                'expires_at' => now()->addDays($this->settings->int('invitation_expiry_days')),
            ]);

            $this->scheduler->invitationCreated($invitation);
            $this->chat->conversationFor($project, $studentUserId);
            $this->notifications->notify($student, 'INVITATION_RECEIVED', 'Undangan project baru',
                "Anda diundang ke project \"{$project->title}\".",
                ['project_id' => $project->id, 'invitation_id' => $invitation->id], [NotificationService::EMAIL]);

            return $invitation;
        });
    }

    public function accept(Invitation $invitation, User $student): Invitation
    {
        $this->assertInvitee($invitation, $student);
        $this->expireIfOverdue($invitation);

        return $this->transactions->run(function () use ($invitation, $student) {
            $project = Project::query()->lockForUpdate()->findOrFail($invitation->project_id);
            $invitation = Invitation::query()->lockForUpdate()->findOrFail($invitation->id);

            if ($invitation->status !== 'PENDING') {
                throw new InvalidStateTransition('Only pending invitations can be accepted.', ['status' => $invitation->status]);
            }
            if ($project->status !== 'OPEN') {
                throw new InvalidStateTransition('The project is no longer open.', ['status' => $project->status]);
            }

            StudentProfile::query()->where('user_id', $student->id)->lockForUpdate()->first();
            $this->applications->assertActiveContractLimit($student->id);

            $this->invitations->transition($invitation, 'ACCEPTED');
            $invitation->save();

            return $invitation;
        });
    }

    public function decline(Invitation $invitation, User $student): Invitation
    {
        $this->assertInvitee($invitation, $student);
        $this->expireIfOverdue($invitation);

        return $this->transactions->run(function () use ($invitation) {
            $invitation = Invitation::query()->lockForUpdate()->findOrFail($invitation->id);
            $this->invitations->transition($invitation, 'DECLINED');
            $invitation->save();

            return $invitation;
        });
    }

    /** Undangan yang sudah lewat expires_at ditandai EXPIRED lalu ditolak (409). */
    private function expireIfOverdue(Invitation $invitation): void
    {
        if ($invitation->status !== 'PENDING' || $invitation->expires_at->isFuture()) {
            return;
        }

        $this->transactions->run(function () use ($invitation) {
            $locked = Invitation::query()->lockForUpdate()->findOrFail($invitation->id);
            if ($locked->status === 'PENDING') {
                $this->invitations->transition($locked, 'EXPIRED');
                $locked->save();
            }
        });

        throw new InvalidStateTransition('This invitation has expired.', ['status' => 'EXPIRED']);
    }

    private function assertInvitee(Invitation $invitation, User $student): void
    {
        if ($invitation->student_id !== $student->id) {
            throw new AuthorizationException('Only the invited student can respond to this invitation.');
        }
    }
}
