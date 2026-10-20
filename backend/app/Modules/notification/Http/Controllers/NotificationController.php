<?php

namespace App\Modules\notification\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\UserNotification;
use App\Shared\Http\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

final class NotificationController extends Controller
{
    /** GET /notifications — Login. `?unread=1` untuk yang belum dibaca. */
    public function index(Request $request)
    {
        $input = $request->validate([
            'unread' => ['nullable', 'boolean'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $userId = $request->user()->id;
        $page = UserNotification::query()
            ->where('user_id', $userId)
            ->when($request->boolean('unread'), fn ($query) => $query->whereNull('read_at'))
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($input['per_page'] ?? 20);

        return ApiResponse::success($page->items(), [
            'current_page' => $page->currentPage(),
            'per_page' => $page->perPage(),
            'total' => $page->total(),
            'last_page' => $page->lastPage(),
            'unread_count' => UserNotification::query()->where('user_id', $userId)->whereNull('read_at')->count(),
        ]);
    }

    /** POST /notifications/{id}/read — pemilik notifikasi. */
    public function markRead(Request $request, string $notification)
    {
        if (! Str::isUuid($notification)) {
            abort(404);
        }

        // Notifikasi milik user lain diperlakukan sebagai tidak ada (404), tidak membocorkan keberadaannya.
        $model = UserNotification::query()
            ->whereKey($notification)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        if (! $model->read_at) {
            $model->forceFill(['read_at' => now()])->save();
        }

        return ApiResponse::success($model);
    }
}
