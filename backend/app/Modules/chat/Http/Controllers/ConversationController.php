<?php

namespace App\Modules\chat\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\Message;
use App\Modules\chat\Services\ChatService;
use App\Shared\Http\ApiResponse;
use Illuminate\Http\Request;

final class ConversationController extends Controller
{
    public function __construct(private readonly ChatService $chat) {}

    /** GET /conversations — percakapan milik user (UMKM / mahasiswa), terbaru dulu, dengan jumlah belum dibaca. */
    public function index(Request $request)
    {
        $userId = $request->user()->id;

        $conversations = Conversation::query()
            ->where(fn ($q) => $q->where('umkm_user_id', $userId)->orWhere('student_user_id', $userId))
            ->with('project:id,title')
            ->withCount(['messages as unread_count' => fn ($q) => $q->where('sender_id', '!=', $userId)->whereNull('read_at')])
            ->orderByDesc('updated_at')
            ->paginate(20);

        return ApiResponse::success($conversations->items(), [
            'current_page' => $conversations->currentPage(),
            'total' => $conversations->total(),
            'last_page' => $conversations->lastPage(),
        ]);
    }

    /** GET /conversations/{id}/messages — peserta chat. Pesan dari pihak lain ditandai dibaca. */
    public function messages(Request $request, Conversation $conversation)
    {
        $this->chat->assertParticipant($conversation, $request->user());
        $perPage = min(max((int) $request->query('per_page', 50), 1), 100);

        $page = Message::query()->where('conversation_id', $conversation->id)
            ->orderByDesc('created_at')->orderByDesc('id')->paginate($perPage);
        $this->chat->markRead($conversation, $request->user());

        return ApiResponse::success($page->items(), [
            'current_page' => $page->currentPage(),
            'total' => $page->total(),
            'last_page' => $page->lastPage(),
        ]);
    }

    /** POST /conversations/{id}/messages — peserta chat. */
    public function store(Request $request, Conversation $conversation)
    {
        $input = $request->validate([
            'body' => ['required', 'string', 'max:2000'],
            'attachment_url' => ['nullable', 'url:https', 'max:2048'],
        ]);

        $message = $this->chat->send($conversation, $request->user(), $input['body'], $input['attachment_url'] ?? null);

        return ApiResponse::success($message, [
            'warning' => $message->is_flagged
                ? 'Pesan ini terdeteksi berisi kontak atau ajakan transaksi di luar platform. Transaksi di luar platform tidak dilindungi escrow.'
                : null,
        ], 201);
    }
}
