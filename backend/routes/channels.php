<?php

use App\Models\Conversation;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

// Hanya peserta percakapan yang boleh berlangganan channel chat.
Broadcast::channel('conversation.{conversationId}', function (User $user, string $conversationId) {
    return (bool) Conversation::query()->whereKey($conversationId)->first()?->hasParticipant($user->id);
});
