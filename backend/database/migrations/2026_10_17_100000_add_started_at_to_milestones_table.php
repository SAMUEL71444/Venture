<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('milestones', function (Blueprint $table) {
            // ERD: milestones.started_at, diisi saat milestone LOCKED -> IN_PROGRESS.
            $table->timestamp('started_at')->nullable()->after('max_mentor_returns');
        });
    }

    public function down(): void
    {
        Schema::table('milestones', function (Blueprint $table) {
            $table->dropColumn('started_at');
        });
    }
};
