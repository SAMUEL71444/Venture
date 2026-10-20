<?php

namespace App\Modules\review\Services;

use App\Models\MentorAssignment;
use App\Models\MentorProfile;
use App\Models\Milestone;
use App\Models\User;
use App\Shared\Exceptions\BusinessRuleViolation;
use Illuminate\Support\Facades\DB;

/**
 * Menugaskan mentor ke milestone "sesuai kategori dan beban review"
 * (05-sequence-diagram.md bagian 3). Dipanggil di dalam transaksi pemanggil.
 */
final class MentorAssignmentService
{
    public function activeAssignment(Milestone $milestone, bool $lock = false): ?MentorAssignment
    {
        $query = MentorAssignment::query()
            ->where('milestone_id', $milestone->id)
            ->where('status', 'ACTIVE');

        if ($lock) {
            $query->lockForUpdate();
        }

        return $query->first();
    }

    /**
     * Kembalikan assignment ACTIVE milestone, atau buat baru jika ada mentor yang tersedia.
     * Mengembalikan null jika tidak ada mentor terverifikasi yang masih punya kapasitas.
     */
    /** @param  list<string>  $excludeMentorIds  mentor user id yang tidak boleh dipilih (misal mentor yang diganti) */
    public function ensureAssigned(Milestone $milestone, array $excludeMentorIds = []): ?MentorAssignment
    {
        if ($existing = $this->activeAssignment($milestone, true)) {
            return $existing;
        }

        $categoryId = $milestone->contract()->first()?->project()->value('category_id');

        foreach ($this->candidateProfileIds($categoryId) as $profileId) {
            // Kunci baris profil mentor lalu hitung ulang beban, supaya dua penugasan
            // bersamaan tidak melewati max_active_reviews.
            $profile = MentorProfile::query()->lockForUpdate()->find($profileId);
            if (! $profile || ! $profile->is_available || $profile->verification_status !== 'VERIFIED'
                || in_array($profile->user_id, $excludeMentorIds, true)) {
                continue;
            }

            if ($this->activeLoad($profile->user_id) >= $profile->max_active_reviews) {
                continue;
            }

            return $this->createAssignment($milestone, $profile->user_id);
        }

        return null;
    }

    /** Admin memilih mentor tertentu: wajib mentor ACTIVE + VERIFIED dengan kapasitas tersisa. */
    public function assignSpecific(Milestone $milestone, string $mentorUserId): MentorAssignment
    {
        $profile = MentorProfile::query()->where('user_id', $mentorUserId)->lockForUpdate()->first();
        $user = $profile ? User::query()->find($mentorUserId) : null;

        if (! $profile || ! $user || $user->role !== 'MENTOR' || $user->status !== 'ACTIVE' || $profile->verification_status !== 'VERIFIED') {
            throw new BusinessRuleViolation('Mentor must be an active, verified mentor.');
        }
        if ($this->activeLoad($mentorUserId) >= $profile->max_active_reviews) {
            throw new BusinessRuleViolation('Mentor has no review capacity left.', ['max_active_reviews' => $profile->max_active_reviews]);
        }

        return $this->createAssignment($milestone, $mentorUserId);
    }

    private function createAssignment(Milestone $milestone, string $mentorUserId): MentorAssignment
    {
        $assignment = MentorAssignment::query()->create([
            'milestone_id' => $milestone->id,
            'mentor_id' => $mentorUserId,
            'status' => 'ACTIVE',
            'review_count' => 0,
            'fee_eligible' => false,
            'assigned_at' => now(),
        ]);

        $milestone->mentor_id = $mentorUserId;
        $milestone->save();

        return $assignment;
    }

    /** Assignment ACTIVE ditutup (DONE) saat milestone selesai. */
    public function complete(Milestone $milestone): void
    {
        MentorAssignment::query()
            ->where('milestone_id', $milestone->id)
            ->where('status', 'ACTIVE')
            ->update(['status' => 'DONE', 'updated_at' => now()]);
    }

    /**
     * Kandidat: mentor ACTIVE + VERIFIED + tersedia. Yang punya keahlian di kategori
     * project didahulukan, lalu beban review paling sedikit, lalu yang paling lama terdaftar.
     *
     * @return list<string>
     */
    private function candidateProfileIds(?string $categoryId): array
    {
        $load = DB::table('mentor_assignments')
            ->selectRaw('mentor_id, COUNT(*) as active_count')
            ->where('status', 'ACTIVE')
            ->groupBy('mentor_id');

        $query = MentorProfile::query()
            ->select('mentor_profiles.id')
            ->join('users', 'users.id', '=', 'mentor_profiles.user_id')
            ->leftJoinSub($load, 'mentor_load', 'mentor_load.mentor_id', '=', 'mentor_profiles.user_id')
            ->where('users.role', 'MENTOR')
            ->where('users.status', 'ACTIVE')
            ->where('mentor_profiles.verification_status', 'VERIFIED')
            ->where('mentor_profiles.is_available', true)
            ->whereRaw('COALESCE(mentor_load.active_count, 0) < mentor_profiles.max_active_reviews');

        if ($categoryId) {
            $query->selectRaw(
                'CASE WHEN EXISTS (SELECT 1 FROM mentor_expertises me WHERE me.mentor_id = mentor_profiles.id AND me.category_id = ?) THEN 1 ELSE 0 END AS expertise_match',
                [$categoryId]
            )->orderByDesc('expertise_match');
        }

        return $query
            ->orderByRaw('COALESCE(mentor_load.active_count, 0) ASC')
            ->orderBy('mentor_profiles.created_at')
            ->orderBy('mentor_profiles.id')
            ->pluck('mentor_profiles.id')
            ->all();
    }

    private function activeLoad(string $mentorUserId): int
    {
        return MentorAssignment::query()
            ->where('mentor_id', $mentorUserId)
            ->where('status', 'ACTIVE')
            ->count();
    }
}
