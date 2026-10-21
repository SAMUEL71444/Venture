<?php

namespace App\Modules\admin\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Dana escrow per kontrak untuk panel admin (GET admin/escrows). Whitelist: status &
 * nominal, kontrak, proyek, nama pihak UMKM & mahasiswa, milestone (untuk aksi Cairkan),
 * tanggal. Tanpa data pembayaran gateway, rekening, atau kolom internal lain.
 */
final class AdminEscrowResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $contract = $this->contract;
        $blocked = $this->additional['unresponsive_milestones'] ?? [];

        return [
            'id' => $this->id,
            'status' => $this->status,
            'funded_amount' => (int) $this->funded_amount,
            'held_amount' => (int) $this->held_amount,
            'released_amount' => (int) $this->released_amount,
            'refunded_amount' => (int) $this->refunded_amount,
            'contract' => [
                'id' => $contract->id,
                'contract_no' => $contract->contract_no,
                'status' => $contract->status,
                // Kembalikan dana = penghentian kontrak oleh admin (hanya kontrak berjalan).
                'can_refund' => $contract->status === 'IN_PROGRESS',
            ],
            'project' => $contract->project ? ['id' => $contract->project->id, 'title' => $contract->project->title] : null,
            'umkm' => $contract->umkm ? ['id' => $contract->umkm->id, 'name' => $contract->umkm->name] : null,
            'student' => $contract->student ? ['id' => $contract->student->id, 'name' => $contract->student->name] : null,
            'milestones' => $contract->milestones->sortBy('sequence')->values()->map(fn ($m) => [
                'id' => $m->id,
                'sequence' => $m->sequence,
                'title' => $m->title,
                'amount' => (int) $m->amount,
                'status' => $m->status,
                // Cairkan = force approve, hanya untuk milestone sengketa (ESCALATED).
                'can_release' => $m->status === 'ESCALATED' && ! in_array($m->id, $blocked, true),
            ]),
            'funded_at' => $contract->funded_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
