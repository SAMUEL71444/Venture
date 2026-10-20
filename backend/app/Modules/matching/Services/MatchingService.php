<?php

namespace App\Modules\matching\Services;

use App\Models\Contract;
use App\Models\Project;
use App\Models\StudentProfile;
use App\Shared\Settings\PlatformSettingsService;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Smart matching rule-based (README "Smart Matching"), skor 0–100:
 * skill kategori 35, rating 25, kota sama 15, tingkat penyelesaian 15, ketersediaan 10.
 */
final class MatchingService
{
    private const LEVEL_FACTOR = ['BEGINNER' => 1 / 3, 'INTERMEDIATE' => 2 / 3, 'ADVANCED' => 1.0];

    public function __construct(private readonly PlatformSettingsService $settings) {}

    /**
     * Rekomendasi talent: mahasiswa VERIFIED, ACTIVE, tersedia, punya skill di kategori
     * project, dan belum mencapai batas kontrak aktif. Urut skor tertinggi.
     *
     * @return list<array<string, mixed>>
     */
    public function recommend(Project $project, int $limit = 20): array
    {
        $candidates = StudentProfile::query()
            ->where('verification_status', 'VERIFIED')
            ->where('is_available', true)
            ->whereHas('user', fn ($users) => $users->where('status', 'ACTIVE')->where('role', 'STUDENT'))
            ->whereHas('skills', fn ($skills) => $skills->where('service_categories.id', $project->category_id))
            ->with(['user:id,name', 'university:id,name,city', 'skills'])
            ->get();

        $stats = $this->contractStats($candidates->pluck('user_id'));
        $maxActive = $this->settings->int('max_active_contracts_per_student');

        return $candidates
            ->filter(fn (StudentProfile $student) => ($stats[$student->user_id]['active'] ?? 0) < $maxActive)
            ->map(fn (StudentProfile $student) => [
                'student_id' => $student->user_id,
                'student_profile_id' => $student->id,
                'name' => $student->user->name,
                'university' => $student->university?->only(['id', 'name', 'city']),
                'rating_avg' => (float) $student->rating_avg,
                ...$this->scoreWithStats($student, $project, $stats[$student->user_id] ?? []),
            ])
            ->sortByDesc('match_score')
            ->take($limit)
            ->values()
            ->all();
    }

    /** Skor satu mahasiswa untuk satu project (dipakai saat apply). */
    public function score(StudentProfile $student, Project $project): int
    {
        $student->loadMissing(['skills', 'university']);
        $stats = $this->contractStats(collect([$student->user_id]));

        return $this->scoreWithStats($student, $project, $stats[$student->user_id] ?? [])['match_score'];
    }

    /** @return array{match_score: int, breakdown: array<string, float>} */
    private function scoreWithStats(StudentProfile $student, Project $project, array $stats): array
    {
        $defaultRating = $this->settings->number('matching_default_rating');
        $maxActive = max(1, $this->settings->int('max_active_contracts_per_student'));

        $skill = $student->skills->firstWhere('id', $project->category_id);
        $skillPoints = $skill ? 35 * (self::LEVEL_FACTOR[$skill->pivot->level] ?? 0) : 0;

        // rating_avg 0 = belum pernah dinilai (skala rating 1–5).
        $rating = (float) $student->rating_avg > 0 ? (float) $student->rating_avg : $defaultRating;
        $ratingPoints = 25 * min($rating, 5) / 5;

        $umkmCity = $project->city ?: $project->umkm?->umkmProfile?->city;
        $studentCity = $student->university?->city;
        $cityPoints = $umkmCity && $studentCity && mb_strtolower(trim($umkmCity)) === mb_strtolower(trim($studentCity)) ? 15 : 0;

        // Tingkat penyelesaian = COMPLETED / (COMPLETED + TERMINATED). Tanpa riwayat memakai
        // rasio default yang sama dengan rating default agar mahasiswa baru tetap muncul.
        $finished = ($stats['completed'] ?? 0) + ($stats['terminated'] ?? 0);
        $completionRate = $finished > 0 ? ($stats['completed'] ?? 0) / $finished : $defaultRating / 5;
        $completionPoints = 15 * $completionRate;

        $active = $stats['active'] ?? 0;
        $availabilityPoints = 10 * max(0, 1 - $active / $maxActive);

        $breakdown = [
            'skill' => round($skillPoints, 2),
            'rating' => round($ratingPoints, 2),
            'city' => (float) $cityPoints,
            'completion' => round($completionPoints, 2),
            'availability' => round($availabilityPoints, 2),
        ];

        return [
            'match_score' => (int) max(0, min(100, round(array_sum($breakdown)))),
            'breakdown' => $breakdown,
        ];
    }

    /** @return array<string, array{active: int, completed: int, terminated: int}> */
    private function contractStats(Collection $studentUserIds): array
    {
        if ($studentUserIds->isEmpty()) {
            return [];
        }

        $active = "'".implode("','", Contract::ACTIVE_STATUSES)."'";

        return DB::table('contracts')
            ->whereIn('student_id', $studentUserIds->all())
            ->groupBy('student_id')
            ->selectRaw("student_id,
                SUM(CASE WHEN status IN ({$active}) THEN 1 ELSE 0 END) AS active,
                SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed,
                SUM(CASE WHEN status = 'TERMINATED' THEN 1 ELSE 0 END) AS terminated")
            ->get()
            ->mapWithKeys(fn ($row) => [$row->student_id => [
                'active' => (int) $row->active,
                'completed' => (int) $row->completed,
                'terminated' => (int) $row->terminated,
            ]])
            ->all();
    }
}
