<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Artisan;

/**
 * Katalog universitas dari database/data/universities_id.json.
 * Memakai command universities:import, jadi aman dijalankan ulang (idempoten).
 */
class UniversitySeeder extends Seeder
{
    public function run(): void
    {
        Artisan::call('universities:import');
        $this->command?->getOutput()->write(Artisan::output());
    }
}
