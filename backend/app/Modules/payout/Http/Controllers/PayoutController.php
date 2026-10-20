<?php

namespace App\Modules\payout\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\BankAccount;
use App\Models\Payout;
use App\Models\Wallet;
use App\Modules\payout\Services\PayoutService;
use App\Shared\Http\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class PayoutController extends Controller
{
    private const PROVIDERS = [
        'BANK' => ['BCA', 'BRI', 'BNI', 'MANDIRI', 'BSI', 'CIMB', 'PERMATA', 'DANAMON', 'BTN'],
        'EWALLET' => ['DANA', 'OVO', 'GOPAY', 'SHOPEEPAY', 'LINKAJA'],
    ];

    public function __construct(private readonly PayoutService $payouts) {}

    /** GET /bank-accounts — Mahasiswa, Mentor. Nomor rekening hanya 4 digit terakhir. */
    public function bankAccounts(Request $request)
    {
        return ApiResponse::success(BankAccount::query()->where('user_id', $request->user()->id)
            ->orderByDesc('is_primary')->orderBy('created_at')->get());
    }

    /** POST /bank-accounts — Mahasiswa, Mentor. */
    public function addBankAccount(Request $request)
    {
        $input = $request->validate([
            'channel' => ['required', Rule::in(array_keys(self::PROVIDERS))],
            'provider_code' => ['required', 'string', Rule::in(self::PROVIDERS[$request->input('channel')] ?? [])],
            'account_number' => ['required', 'string', 'regex:/^\d{6,20}$/'],
            'account_holder_name' => ['required', 'string', 'max:120'],
            'is_primary' => ['nullable', 'boolean'],
        ]);

        return ApiResponse::success($this->payouts->addBankAccount($request->user(), $input), [], 201);
    }

    /** GET /wallet/withdrawals/preview?amount=&bank_account_id= */
    public function preview(Request $request)
    {
        $input = $request->validate([
            'amount' => ['required', 'integer', 'min:1'],
            'bank_account_id' => ['nullable', 'uuid'],
        ]);

        return ApiResponse::success($this->payouts->preview($request->user(), (int) $input['amount'], $input['bank_account_id'] ?? null));
    }

    /** GET /wallet/withdrawals — riwayat penarikan milik sendiri. */
    public function index(Request $request)
    {
        $walletId = Wallet::query()->where('user_id', $request->user()->id)->where('type', $request->user()->role)->value('id');

        return ApiResponse::success(Payout::query()
            ->when($walletId, fn ($q) => $q->where('wallet_id', $walletId), fn ($q) => $q->whereRaw('1 = 0'))
            ->with('bankAccount')->orderByDesc('requested_at')->limit(50)->get());
    }

    /** POST /wallet/withdrawals — minimal Rp 20.000, biaya transfer ditanggung penarik. */
    public function store(Request $request)
    {
        $input = $request->validate([
            'amount' => ['required', 'integer', 'min:1'],
            'bank_account_id' => ['required', 'uuid'],
        ]);

        return ApiResponse::success(
            $this->payouts->request($request->user(), (int) $input['amount'], $input['bank_account_id'], $request->ip())->load('bankAccount'),
            [], 201,
        );
    }

    /** POST /webhooks/disbursement — gateway, autentikasi lewat signature. */
    public function webhook(Request $request)
    {
        return ApiResponse::success($this->payouts->handleWebhook($request->getContent(), $request->headers->all()));
    }
}
