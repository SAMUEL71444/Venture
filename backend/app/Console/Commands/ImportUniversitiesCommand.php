<?php

namespace App\Console\Commands;

use App\Models\University;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

/**
 * Impor katalog universitas dari JSON (default database/data/universities_id.json).
 * Idempoten: dicocokkan berdasarkan nama (tanpa beda huruf besar/kecil), jadi aman
 * dijalankan ulang. Baris yang sudah ada TIDAK ditimpa — hanya kolom yang masih
 * kosong yang diisi — dan is_partner tidak pernah disentuh.
 */
class ImportUniversitiesCommand extends Command
{
    protected $signature = 'universities:import {--path= : Path file JSON (default database/data/universities_id.json)}';

    protected $description = 'Import the university catalog from JSON without overwriting existing data';

    /** Kolom yang diisi dari JSON (is_partner sengaja tidak termasuk). */
    private const FILLABLE = ['short_name', 'city', 'province', 'email_domain'];

    public function handle(): int
    {
        $path = $this->option('path') ?: database_path('data/universities_id.json');

        if (! is_file($path)) {
            $this->error("File not found: {$path}");

            return self::FAILURE;
        }

        $rows = json_decode((string) file_get_contents($path), true);

        if (! is_array($rows) || ! array_is_list($rows)) {
            $this->error('The file must contain a JSON array of universities.');

            return self::FAILURE;
        }

        $validator = Validator::make(['rows' => $rows], [
            'rows.*.name' => ['required', 'string', 'max:255'],
            'rows.*.short_name' => ['nullable', 'string', 'max:30'],
            'rows.*.city' => ['nullable', 'string', 'max:255'],
            'rows.*.province' => ['nullable', 'string', 'max:60'],
            'rows.*.email_domain' => ['nullable', 'string', 'max:255', 'regex:/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i'],
        ]);

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $message) {
                $this->error($message);
            }

            return self::FAILURE;
        }

        $counts = ['created' => 0, 'updated' => 0, 'unchanged' => 0];
        $warnings = [];

        DB::transaction(function () use ($rows, &$counts, &$warnings) {
            foreach ($rows as $row) {
                $name = trim($row['name']);
                $values = [
                    'short_name' => $this->clean($row['short_name'] ?? null),
                    'city' => $this->clean($row['city'] ?? null),
                    'province' => $this->clean($row['province'] ?? null),
                    'email_domain' => ($domain = $this->clean($row['email_domain'] ?? null)) ? Str::lower($domain) : null,
                ];

                $university = University::query()->whereRaw('LOWER(name) = ?', [Str::lower($name)])->first();

                // email_domain unik: jangan pakai domain yang sudah dimiliki universitas lain.
                if ($values['email_domain'] && University::query()
                    ->where('email_domain', $values['email_domain'])
                    ->when($university, fn ($query) => $query->whereKeyNot($university->id))
                    ->exists()) {
                    $warnings[] = "{$name}: email_domain {$values['email_domain']} is already used by another university, skipped.";
                    $values['email_domain'] = null;
                }

                if (! $university) {
                    University::query()->create(['name' => $name, ...$values, 'is_partner' => false]);
                    $counts['created']++;

                    continue;
                }

                // Hanya isi kolom yang masih kosong; nilai yang ada (mis. hasil ubahan admin) dipertahankan.
                foreach (self::FILLABLE as $column) {
                    if ($university->{$column} === null && $values[$column] !== null) {
                        $university->{$column} = $values[$column];
                    }
                }

                if ($university->isDirty()) {
                    $university->save();
                    $counts['updated']++;
                } else {
                    $counts['unchanged']++;
                }
            }
        });

        foreach ($warnings as $warning) {
            $this->warn($warning);
        }

        $this->info(sprintf(
            'Universities: %d created, %d updated (empty columns filled), %d unchanged. Total in catalog: %d.',
            $counts['created'], $counts['updated'], $counts['unchanged'], University::query()->count(),
        ));

        return self::SUCCESS;
    }

    private function clean(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $value = trim(preg_replace('/\s+/u', ' ', $value));

        return $value === '' ? null : $value;
    }
}
