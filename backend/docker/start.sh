#!/bin/sh
# Skrip start container (Render). Data demo TIDAK di-seed otomatis.
set -e

PORT="${PORT:-10000}"
sed -i "s/^Listen .*/Listen ${PORT}/" /etc/apache2/ports.conf
sed -i "s/<VirtualHost \*:[0-9]*>/<VirtualHost *:${PORT}>/" /etc/apache2/sites-available/000-default.conf

# Server publik (production maupun staging) tidak boleh APP_DEBUG=true.
if [ "${APP_ENV}" != "local" ] && [ "${APP_DEBUG}" = "true" ]; then
    echo "!!! PERINGATAN: APP_DEBUG=true di APP_ENV=${APP_ENV:-production}. Detail error & konfigurasi bisa bocor ke publik. Set APP_DEBUG=false. !!!" >&2
fi
if [ -z "${APP_KEY}" ]; then
    echo "!!! APP_KEY kosong. Buat dengan: php artisan key:generate --show, lalu isi di environment Render. !!!" >&2
    exit 1
fi

php artisan config:cache
php artisan route:cache
php artisan migrate --force
# Katalog universitas idempoten: hanya menambah yang belum ada, tidak menimpa data.
php artisan universities:import

# Perintah di atas berjalan sebagai root; pastikan Apache (www-data) tetap bisa menulis log/cache.
chown -R www-data:www-data storage bootstrap/cache

exec apache2-foreground
