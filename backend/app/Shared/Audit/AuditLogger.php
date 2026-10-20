<?php

namespace App\Shared\Audit;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

final class AuditLogger
{
    public function log(?User $actor, string $action, Model $entity, ?array $before, ?array $after, ?string $ip = null): void
    {
        $this->logRaw($actor, $action, $entity::class, (string) $entity->getKey(), $before, $after, $ip);
    }

    public function logRaw(?User $actor, string $action, string $entityType, string $entityId, ?array $before, ?array $after, ?string $ip = null): void
    {
        AuditLog::query()->create([
            'actor_id' => $actor?->id,
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'before_data' => $before,
            'after_data' => $after,
            'ip_address' => $ip,
        ]);
    }
}
