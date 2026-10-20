<?php

namespace App\Modules\chat\Services;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\Project;
use App\Models\User;
use App\Modules\chat\Events\MessageSent;
use Illuminate\Auth\Access\AuthorizationException;

/**
 * Chat UMKM <-> mahasiswa per project (ERD CONVERSATIONS/MESSAGES). Percakapan dibuat otomatis
 * saat ada lamaran/undangan dan ditautkan ke kontrak saat lamaran diterima.
 */
final class ChatService
{
    /**
     * Deteksi nomor HP, email, tautan WhatsApp, dan ajakan transaksi di luar platform.
     * Pesan tetap terkirim tetapi ditandai (is_flagged) untuk ditinjau admin.
     */
    private const FLAG_PATTERNS = [
        '/(?:\+?62|\b0)8\d{7,12}\b/',
        '/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i',
        '/\b(?:wa\.me|whatsapp\.com|t\.me|line\.me)\b/i',
        '/\b(?:transfer langsung|bayar langsung|di luar (?:platform|aplikasi)|luar aplikasi|no\.? ?rek(?:ening)?|nomor rekening|rekening saya|cod)\b/i',
    ];

    public function conversationFor(Project $project, string $studentUserId, ?string $contractId = null): Conversation
    {
        $conversation = Conversation::query()->where('project_id', $project->id)->where('student_user_id', $studentUserId)->first()
            ?? Conversation::query()->createOrFirst(
                ['project_id' => $project->id, 'student_user_id' => $studentUserId],
                ['umkm_user_id' => $project->umkm_id],
            );

        if ($contractId && $conversation->contract_id !== $contractId) {
            $conversation->contract_id = $contractId;
            $conversation->save();
        }

        return $conversation;
    }

    public function send(Conversation $conversation, User $sender, string $body, ?string $attachmentUrl): Message
    {
        $this->assertParticipant($conversation, $sender);

        $message = Message::query()->create([
            'conversation_id' => $conversation->id,
            'sender_id' => $sender->id,
            'body' => $body,
            'attachment_url' => $attachmentUrl,
            'is_flagged' => self::isSuspicious($body),
        ]);

        $conversation->touch();
        MessageSent::dispatch($message);

        return $message;
    }

    /** Tandai pesan dari pihak lain sebagai dibaca. */
    public function markRead(Conversation $conversation, User $reader): int
    {
        $this->assertParticipant($conversation, $reader);

        return Message::query()->where('conversation_id', $conversation->id)
            ->where('sender_id', '!=', $reader->id)->whereNull('read_at')
            ->update(['read_at' => now()]);
    }

    public function assertParticipant(Conversation $conversation, User $user): void
    {
        if (! $conversation->hasParticipant($user->id)) {
            throw new AuthorizationException('You are not a participant of this conversation.');
        }
    }

    public static function isSuspicious(string $body): bool
    {
        $normalized = preg_replace('/(?<=\d)[\s.\-]+(?=\d)/', '', $body) ?? $body;

        foreach (self::FLAG_PATTERNS as $pattern) {
            if (preg_match($pattern, $normalized)) {
                return true;
            }
        }

        return false;
    }
}
