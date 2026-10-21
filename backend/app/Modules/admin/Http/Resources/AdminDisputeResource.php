<?php

namespace App\Modules\admin\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Sengketa milestone untuk panel admin. Whitelist: status alert, alasan & pengaju,
 * milestone, kontrak, proyek, nama pihak, dan (detail) riwayat pengajuan + review
 * (catatan, keputusan, nama file). Tanpa path/URL file, kontak, atau kolom internal.
 */
final class AdminDisputeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $milestone = $this->additional['milestone'] ?? null;
        $dispute = $this->additional['dispute']?->after_data ?? [];
        $contract = $milestone?->contract;

        $data = [
            'id' => $this->id,
            'status' => $this->status,
            'severity' => $this->severity,
            'reason' => $dispute['reason'] ?? null,
            'requester_role' => $dispute['requester_role'] ?? null,
            'resolution_notes' => $this->resolution_notes,
            'opened_at' => $this->created_at?->toIso8601String(),
            'resolved_at' => $this->resolved_at?->toIso8601String(),
            'milestone' => $milestone ? [
                'id' => $milestone->id,
                'sequence' => $milestone->sequence,
                'title' => $milestone->title,
                'amount' => (int) $milestone->amount,
                'status' => $milestone->status,
                'revision_count' => (int) $milestone->revision_count,
                'max_revisions' => (int) $milestone->max_revisions,
                // Keputusan admin hanya untuk milestone yang masih ESCALATED.
                'can_decide' => $milestone->status === 'ESCALATED',
            ] : null,
            'contract' => $contract ? ['id' => $contract->id, 'contract_no' => $contract->contract_no, 'status' => $contract->status] : null,
            'project' => $contract?->project ? ['id' => $contract->project->id, 'title' => $contract->project->title] : null,
            'umkm' => $contract?->umkm ? ['id' => $contract->umkm->id, 'name' => $contract->umkm->name] : null,
            'student' => $contract?->student ? ['id' => $contract->student->id, 'name' => $contract->student->name] : null,
        ];

        if (! empty($this->additional['with_history']) && $milestone) {
            $data['history'] = $milestone->submissions->map(fn ($submission) => [
                'version' => $submission->version_no,
                'status' => $submission->status,
                'notes' => $submission->notes,
                'submitted_at' => $submission->submitted_at?->toIso8601String(),
                'files' => $submission->files->pluck('file_name')->values(),
                'reviews' => $submission->reviews->map(fn ($review) => [
                    'reviewer_role' => $review->reviewer_role,
                    'decision' => $review->decision,
                    'feedback' => $review->feedback,
                    'reviewed_at' => $review->reviewed_at?->toIso8601String(),
                ])->values(),
            ])->values();
        }

        return $data;
    }
}
