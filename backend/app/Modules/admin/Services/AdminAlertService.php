<?php

namespace App\Modules\admin\Services;

use App\Models\AdminAlert;
use App\Modules\admin\State\AdminAlertStateMachine;

final class AdminAlertService
{
    public const UNRESOLVED = ['OPEN', 'FOLLOWED_UP', 'AWAITING_DECISION'];

    public function __construct(private readonly AdminAlertStateMachine $stateMachine) {}

    /**
     * Buka alert admin. Idempotent: jika alert dengan tipe dan referensi yang sama
     * masih belum RESOLVED, alert itu yang dikembalikan (tidak membuat duplikat).
     * Harus dipanggil di dalam transaksi yang sudah mengunci entitas referensinya.
     */
    public function open(string $type, string $severity, string $referenceType, string $referenceId): AdminAlert
    {
        $existing = AdminAlert::query()
            ->where('type', $type)
            ->where('reference_type', $referenceType)
            ->where('reference_id', $referenceId)
            ->whereIn('status', self::UNRESOLVED)
            ->first();

        if ($existing) {
            return $existing;
        }

        return AdminAlert::query()->create([
            'type' => $type,
            'severity' => $severity,
            'reference_type' => $referenceType,
            'reference_id' => $referenceId,
            'status' => 'OPEN',
        ]);
    }

    /**
     * Tutup alert yang masih berada di salah satu status $fromStatuses (misal UMKM akhirnya merespons).
     *
     * @param  list<string>  $fromStatuses
     */
    public function resolve(string $type, string $referenceType, string $referenceId, string $notes, array $fromStatuses): int
    {
        $alerts = AdminAlert::query()
            ->where('type', $type)
            ->where('reference_type', $referenceType)
            ->where('reference_id', $referenceId)
            ->whereIn('status', $fromStatuses)
            ->lockForUpdate()
            ->get();

        foreach ($alerts as $alert) {
            $this->stateMachine->transition($alert, 'RESOLVED');
            $alert->resolution_notes = $notes;
            $alert->resolved_at = now();
            $alert->save();
        }

        return $alerts->count();
    }

    /**
     * Keputusan admin menuntaskan semua alert yang belum RESOLVED untuk referensi tertentu.
     *
     * @param  list<string>  $milestoneIds
     */
    public function resolveAllFor(array $milestoneIds, ?string $contractId, ?string $cancellationId, string $notes): int
    {
        $alerts = AdminAlert::query()
            ->whereIn('status', self::UNRESOLVED)
            ->where(function ($query) use ($milestoneIds, $contractId, $cancellationId) {
                $query->where(fn ($q) => $q->where('reference_type', 'MILESTONE')->whereIn('reference_id', $milestoneIds));
                if ($contractId) {
                    $query->orWhere(fn ($q) => $q->where('reference_type', 'CONTRACT')->where('reference_id', $contractId));
                }
                if ($cancellationId) {
                    $query->orWhere(fn ($q) => $q->where('reference_type', 'CANCELLATION')->where('reference_id', $cancellationId));
                }
            })
            ->lockForUpdate()
            ->get();

        foreach ($alerts as $alert) {
            $this->stateMachine->transition($alert, 'RESOLVED');
            $alert->resolution_notes = $notes;
            $alert->resolved_at = now();
            $alert->save();
        }

        return $alerts->count();
    }
}
