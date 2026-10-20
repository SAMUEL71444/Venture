<?php

namespace App\Modules\admin\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\admin\Services\FinanceReportService;
use App\Modules\admin\Services\SettingsService;
use App\Shared\Http\ApiResponse;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

final class AdminSettingsController extends Controller
{
    /** GET /admin/settings */
    public function index(SettingsService $settings)
    {
        return ApiResponse::success($settings->all());
    }

    /** PUT /admin/settings — body: { "settings": { "platform_fee_pct": 12, ... } } */
    public function update(Request $request, SettingsService $settings)
    {
        $input = $request->validate(['settings' => ['required', 'array']]);

        return ApiResponse::success($settings->update($input['settings'], $request->user(), $request->ip()));
    }

    /** GET /admin/reports/finance?from=YYYY-MM-DD&to=YYYY-MM-DD (tanggal WIB, `to` inklusif). */
    public function finance(Request $request, FinanceReportService $reports)
    {
        $input = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);
        $tz = config('app.business_timezone');

        return ApiResponse::success($reports->summary(
            isset($input['from']) ? CarbonImmutable::parse($input['from'], $tz)->startOfDay()->utc() : null,
            isset($input['to']) ? CarbonImmutable::parse($input['to'], $tz)->addDay()->startOfDay()->utc() : null,
        ));
    }
}
