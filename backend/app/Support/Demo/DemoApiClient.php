<?php

namespace App\Support\Demo;

use App\Models\User;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * Memanggil API aplikasi sendiri secara internal (lewat HTTP kernel, tanpa jaringan)
 * sebagai akun demo. Dengan begitu data demo melewati validasi, middleware, state
 * machine, service, notifikasi, dan audit log yang sama persis dengan pengguna asli.
 */
final class DemoApiClient
{
    /** @var array<string, string> token Sanctum per user id */
    private array $tokens = [];

    public function __construct(private readonly Kernel $kernel) {}

    public function get(User $actor, string $uri): array
    {
        return $this->send($actor, 'GET', $uri);
    }

    public function post(User $actor, string $uri, array $data = []): array
    {
        return $this->send($actor, 'POST', $uri, $data);
    }

    public function put(User $actor, string $uri, array $data = []): array
    {
        return $this->send($actor, 'PUT', $uri, $data);
    }

    /** Multipart (unggah file). */
    public function upload(User $actor, string $uri, array $data, array $files): array
    {
        return $this->send($actor, 'POST', $uri, $data, $files);
    }

    /** Request tanpa login dengan body mentah (mis. webhook gateway pembayaran). */
    public function raw(string $uri, string $body, array $headers): array
    {
        return $this->send(null, 'POST', $uri, [], [], $headers, $body);
    }

    /** Cabut token sementara yang dibuat untuk seeding. */
    public function revokeTokens(): void
    {
        User::query()->whereIn('id', array_keys($this->tokens))->get()
            ->each(fn (User $user) => $user->tokens()->where('name', 'demo-seed')->delete());
        $this->tokens = [];
        // Jangan tinggalkan user hasil request internal terakhir di guard aplikasi.
        app('auth')->forgetGuards();
    }

    private function send(?User $actor, string $method, string $uri, array $data = [], array $files = [], array $headers = [], ?string $raw = null): array
    {
        app('auth')->forgetGuards();

        $server = ['HTTP_ACCEPT' => 'application/json', 'REMOTE_ADDR' => '127.0.0.1'];
        if ($actor) {
            $server['HTTP_AUTHORIZATION'] = 'Bearer '.($this->tokens[$actor->id] ??= $actor->createToken('demo-seed')->plainTextToken);
        }
        foreach ($headers as $name => $value) {
            $server['HTTP_'.strtoupper(str_replace('-', '_', $name))] = $value;
        }

        if ($files) {
            $request = Request::create('/api/v1'.$uri, $method, $data, [], $files, $server);
        } else {
            $server['CONTENT_TYPE'] = 'application/json';
            $request = Request::create('/api/v1'.$uri, $method, [], [], [], $server, $raw ?? json_encode($data, JSON_THROW_ON_ERROR));
        }

        $response = $this->kernel->handle($request);
        $body = json_decode((string) $response->getContent(), true);

        if ($response->getStatusCode() >= 400) {
            throw new RuntimeException(sprintf(
                'Demo seed: %s %s gagal (HTTP %d %s): %s',
                $method, $uri, $response->getStatusCode(), $body['error']['code'] ?? '-', $body['error']['message'] ?? '',
            ));
        }

        return $body['data'] ?? [];
    }
}
