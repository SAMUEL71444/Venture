<?php

namespace App\Modules\ledger\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\LedgerEntry;
use App\Models\Wallet;
use App\Shared\Http\ApiResponse;
use Illuminate\Http\Request;

final class WalletController extends Controller
{
    /** GET /wallet — Mahasiswa, Mentor. Saldo + riwayat ledger wallet sendiri. */
    public function show(Request $request)
    {
        $user = $request->user();
        $perPage = min(max((int) $request->query('per_page', 20), 1), 50);

        $wallet = Wallet::query()->where('user_id', $user->id)->where('type', $user->role)->first();

        $entries = LedgerEntry::query()
            ->when($wallet, fn ($query) => $query->where('wallet_id', $wallet->id), fn ($query) => $query->whereRaw('1 = 0'))
            ->with('transaction:id,type,reference_type,reference_id,description,created_at')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($perPage);

        return ApiResponse::success([
            'wallet' => [
                'id' => $wallet?->id,
                'type' => $user->role,
                'balance' => $wallet?->balance ?? 0,
                'pending_withdrawal' => $wallet?->pending_withdrawal ?? 0,
            ],
            'entries' => $entries->items(),
        ], [
            'current_page' => $entries->currentPage(),
            'per_page' => $entries->perPage(),
            'total' => $entries->total(),
            'last_page' => $entries->lastPage(),
        ]);
    }
}
