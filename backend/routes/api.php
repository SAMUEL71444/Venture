<?php

use App\Modules\admin\Http\Controllers\AdminAlertController;
use App\Modules\admin\Http\Controllers\AdminDashboardController;
use App\Modules\admin\Http\Controllers\AdminDecisionController;
use App\Modules\admin\Http\Controllers\AdminDisputeController;
use App\Modules\admin\Http\Controllers\AdminEscrowController;
use App\Modules\admin\Http\Controllers\AdminSettingsController;
use App\Modules\admin\Http\Controllers\AdminUserController;
use App\Modules\application\Http\Controllers\ApplicationController;
use App\Modules\application\Http\Controllers\InvitationController;
use App\Modules\auth\Http\Controllers\AuthController;
use App\Modules\auth\Http\Controllers\PasswordResetController;
use App\Modules\auth\Http\Controllers\VerificationController;
use App\Modules\cancellation\Http\Controllers\CancellationController;
use App\Modules\certificate\Http\Controllers\CertificateController;
use App\Modules\chat\Http\Controllers\ConversationController;
use App\Modules\contract\Http\Controllers\ContractController;
use App\Modules\ledger\Http\Controllers\WalletController;
use App\Modules\notification\Http\Controllers\NotificationController;
use App\Modules\payment\Http\Controllers\PaymentController;
use App\Modules\payment\Http\Controllers\PaymentWebhookController;
use App\Modules\payout\Http\Controllers\PayoutController;
use App\Modules\profile\Http\Controllers\ProfileController;
use App\Modules\project\Http\Controllers\ProjectController;
use App\Modules\review\Http\Controllers\MilestoneReviewController;
use App\Shared\Http\ApiResponse;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::get('/health', fn () => ApiResponse::success(['status' => 'ok']));

    Route::prefix('auth')->group(function () {
        Route::post('/otp/send', [AuthController::class, 'sendOtp'])->middleware('throttle:otp-send');
        Route::post('/otp/verify', [AuthController::class, 'verifyOtp'])->middleware('throttle:otp-verify');
        Route::post('/register/umkm', [AuthController::class, 'registerUmkm'])->middleware('throttle:register');
        Route::post('/register/student', [AuthController::class, 'registerStudent'])->middleware('throttle:register');
        Route::post('/register/mentor', [AuthController::class, 'registerMentor'])->middleware('throttle:register');
        Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');
        Route::post('/refresh', [AuthController::class, 'refresh'])->middleware('throttle:refresh');
        Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');
        Route::post('/password/otp/send', [PasswordResetController::class, 'sendOtp'])->middleware('throttle:password-otp-send');
        Route::post('/password/otp/verify', [PasswordResetController::class, 'verifyOtp'])->middleware('throttle:password-otp-verify');
        Route::post('/password/reset', [PasswordResetController::class, 'reset'])->middleware('throttle:password-reset');
        Route::get('/email/verify/{profile}/{hash}', [VerificationController::class, 'verifyCampusEmail'])
            ->middleware('signed')
            ->name('auth.email.verify');
    });

    Route::get('/universities', [ProfileController::class, 'universities']);
    Route::get('/categories', [ProfileController::class, 'categories']);
    Route::get('/templates', [ProjectController::class, 'templates']);
    Route::post('/webhooks/payment-gateway', PaymentWebhookController::class);
    Route::post('/webhooks/disbursement', [PayoutController::class, 'webhook']);
    Route::get('/certificates/{code}/verify', [CertificateController::class, 'verify'])->middleware('throttle:60,1');

    Route::middleware(['auth:sanctum', 'account.access'])->group(function () {
        Route::get('/me/profile', [ProfileController::class, 'me']);
        Route::put('/me/profile', [ProfileController::class, 'update']);

        Route::middleware('role:STUDENT')->prefix('students/me')->group(function () {
            Route::post('/campus-email/verification', [VerificationController::class, 'sendCampusEmailVerification'])->middleware('throttle:campus-email');
            Route::post('/verification', [VerificationController::class, 'uploadKtm']);
            Route::put('/skills', [ProfileController::class, 'updateSkills']);
            Route::post('/portfolio', [ProfileController::class, 'createPortfolio']);
        });

        Route::middleware('role:UMKM')->get('/students', [ProfileController::class, 'students']);
        Route::get('/students/{student}', [ProfileController::class, 'student']);
        Route::middleware('role:MENTOR')->put('/mentors/me/availability', [ProfileController::class, 'mentorAvailability']);

        Route::middleware('role:UMKM')->group(function () {
            Route::post('/projects', [ProjectController::class, 'store']);
            Route::put('/projects/{project}', [ProjectController::class, 'update']);
            Route::post('/projects/{project}/publish', [ProjectController::class, 'publish']);
            Route::post('/projects/{project}/cancel', [ProjectController::class, 'cancel']);
            Route::post('/projects/{project}/invitations', [InvitationController::class, 'invite']);
            Route::get('/projects/{project}/applications', [ApplicationController::class, 'index']);
            Route::get('/projects/{project}/recommendations', [ProjectController::class, 'recommendations']);
            Route::post('/applications/{application}/accept', [ApplicationController::class, 'accept']);
            Route::post('/applications/{application}/reject', [ApplicationController::class, 'reject']);
            Route::post('/contracts/{contract}/payments', [PaymentController::class, 'store']);
            Route::post('/projects/{project}/premium', [ProjectController::class, 'premium']);
        });

        Route::middleware('role:STUDENT')->group(function () {
            Route::post('/projects/{project}/applications', [ApplicationController::class, 'store']);
            Route::post('/invitations/{invitation}/accept', [InvitationController::class, 'accept']);
            Route::post('/invitations/{invitation}/decline', [InvitationController::class, 'decline']);
            Route::post('/applications/{application}/withdraw', [ApplicationController::class, 'withdraw']);
            Route::post('/contracts/{contract}/start', [ContractController::class, 'start']);
            Route::post('/milestones/{milestone}/submissions', [MilestoneReviewController::class, 'submit']);
        });

        Route::middleware('role:MENTOR')->group(function () {
            Route::get('/mentor/review-queue', [MilestoneReviewController::class, 'reviewQueue']);
            Route::post('/submissions/{submission}/mentor-review', [MilestoneReviewController::class, 'mentorReview']);
        });

        Route::middleware('role:UMKM')->group(function () {
            Route::post('/submissions/{submission}/client-review', [MilestoneReviewController::class, 'clientReview']);
        });

        Route::middleware('role:STUDENT,MENTOR')->group(function () {
            Route::get('/wallet', [WalletController::class, 'show']);
            Route::get('/wallet/withdrawals/preview', [PayoutController::class, 'preview']);
            Route::get('/wallet/withdrawals', [PayoutController::class, 'index']);
            Route::post('/wallet/withdrawals', [PayoutController::class, 'store']);
            Route::get('/bank-accounts', [PayoutController::class, 'bankAccounts']);
            Route::post('/bank-accounts', [PayoutController::class, 'addBankAccount']);
        });
        Route::middleware('role:STUDENT')->get('/students/me/certificates', [CertificateController::class, 'mine']);
        Route::middleware('role:UMKM,STUDENT')->group(function () {
            Route::post('/contracts/{contract}/cancellations', [CancellationController::class, 'store']);
            Route::post('/cancellations/{cancellation}/responses', [CancellationController::class, 'respond']);
            Route::post('/cancellations/{cancellation}/withdraw', [CancellationController::class, 'withdraw']);
            Route::post('/contracts/{contract}/ratings', [CertificateController::class, 'rate']);
            Route::get('/conversations', [ConversationController::class, 'index']);
            Route::get('/conversations/{conversation}/messages', [ConversationController::class, 'messages']);
            Route::post('/conversations/{conversation}/messages', [ConversationController::class, 'store']);
        });
        Route::middleware('role:UMKM,STUDENT')->post('/milestones/{milestone}/disputes', [MilestoneReviewController::class, 'dispute']);
        Route::get('/submissions/{submission}/files/{file}', [MilestoneReviewController::class, 'downloadFile']);

        Route::middleware('role:ADMIN')->prefix('admin')->group(function () {
            Route::get('/verifications', [VerificationController::class, 'index']);
            Route::get('/students/{student}/ktm', [VerificationController::class, 'downloadKtm']);
            Route::get('/alerts', [AdminAlertController::class, 'index']);
            Route::get('/alerts/{alert}', [AdminAlertController::class, 'show']);
            Route::post('/alerts/{alert}/follow-ups', [AdminAlertController::class, 'followUp']);
            Route::get('/cancellations/{cancellation}', [AdminDecisionController::class, 'showCancellation']);
            Route::post('/cancellations/{cancellation}/approve', [AdminDecisionController::class, 'approveCancellation']);
            Route::post('/cancellations/{cancellation}/reject', [AdminDecisionController::class, 'rejectCancellation']);
            Route::post('/contracts/{contract}/terminate', [AdminDecisionController::class, 'terminateContract']);
            Route::post('/milestones/{milestone}/force-approve', [AdminDecisionController::class, 'forceApprove']);
            Route::post('/milestones/{milestone}/return-to-student', [AdminDecisionController::class, 'returnToStudent']);
            Route::post('/milestones/{milestone}/reassign-mentor', [AdminDecisionController::class, 'reassignMentor']);
            Route::post('/milestones/{milestone}/extra-chance', [AdminDecisionController::class, 'extraChance']);
            Route::post('/milestones/{milestone}/forward-to-client', [AdminDecisionController::class, 'forwardToClient']);
            Route::get('/dashboard/summary', [AdminDashboardController::class, 'summary']);
            Route::get('/escrows', [AdminEscrowController::class, 'index']);
            Route::get('/disputes', [AdminDisputeController::class, 'index']);
            Route::get('/disputes/{alert}', [AdminDisputeController::class, 'show']);
            Route::get('/users', [AdminUserController::class, 'index']);
            Route::get('/users/{user}', [AdminUserController::class, 'show']);
            Route::post('/users/{user}/suspend', [AdminDecisionController::class, 'suspendUser']);
            Route::get('/settings', [AdminSettingsController::class, 'index']);
            Route::put('/settings', [AdminSettingsController::class, 'update']);
            Route::get('/reports/finance', [AdminSettingsController::class, 'finance']);
            Route::post('/verifications/{id}/{decision}', [VerificationController::class, 'decide'])
                ->whereUuid('id')
                ->whereIn('decision', ['approve', 'reject']);
        });

        Route::get('/projects', [ProjectController::class, 'index']);
        Route::get('/projects/{project}', [ProjectController::class, 'show']);
        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::post('/notifications/{notification}/read', [NotificationController::class, 'markRead']);
        Route::get('/contracts', [ContractController::class, 'index']);
        Route::get('/contracts/{contract}', [ContractController::class, 'show']);
    });
});
