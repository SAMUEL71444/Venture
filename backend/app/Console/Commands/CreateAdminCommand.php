<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;

class CreateAdminCommand extends Command
{
    // Interaktif (tanpa opsi) atau non-interaktif untuk server:
    //   ADMIN_PASSWORD='...' php artisan auth:create-admin --name="Admin" --email=admin@domain --password-env=ADMIN_PASSWORD
    // Password dibaca dari variabel lingkungan (bukan argumen) supaya tidak tercatat di riwayat shell,
    // daftar proses, output, maupun log.
    protected $signature = 'auth:create-admin
        {--name= : Nama admin}
        {--email= : Email admin}
        {--password-env= : Nama variabel lingkungan yang berisi password (mode non-interaktif)}';

    protected $description = 'Create the first administrator account interactively';

    public function handle(): int
    {
        $name = trim((string) ($this->option('name') ?? $this->ask('Admin name')));
        $email = strtolower(trim((string) ($this->option('email') ?? $this->ask('Admin email'))));

        if ($envName = $this->option('password-env')) {
            $password = (string) (getenv($envName) ?: ($_ENV[$envName] ?? $_SERVER[$envName] ?? ''));

            if ($password === '') {
                $this->error("Environment variable {$envName} is empty or not set.");

                return self::FAILURE;
            }

            $passwordConfirmation = $password;
        } else {
            $password = $this->secret('Admin password');
            $passwordConfirmation = $this->secret('Confirm admin password');
        }

        Validator::make([
            'name' => $name,
            'email' => $email,
            'password' => $password,
            'password_confirmation' => $passwordConfirmation,
        ], [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email:rfc', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:12', 'confirmed'],
        ])->validate();

        User::query()->create([
            'name' => $name,
            'email' => $email,
            'password_hash' => $password,
            'role' => 'ADMIN',
            'status' => 'ACTIVE',
            'email_verified_at' => now(),
        ]);

        $this->info('Administrator account created.');

        return self::SUCCESS;
    }
}
