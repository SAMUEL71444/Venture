<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;

class CreateAdminCommand extends Command
{
    protected $signature = 'auth:create-admin';

    protected $description = 'Create the first administrator account interactively';

    public function handle(): int
    {
        $name = trim($this->ask('Admin name'));
        $email = strtolower(trim($this->ask('Admin email')));
        $password = $this->secret('Admin password');
        $passwordConfirmation = $this->secret('Confirm admin password');

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
