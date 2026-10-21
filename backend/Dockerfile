# Backend Laravel untuk Render (Docker). PHP 8.2 sesuai composer.json ("php": "^8.2").
FROM php:8.2-apache-bookworm

# Ekstensi: pdo_pgsql/pgsql (Neon), bcmath (nominal uang), intl, zip, opcache.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev libicu-dev libzip-dev unzip \
    && docker-php-ext-install -j"$(nproc)" pdo_pgsql pgsql bcmath intl zip opcache \
    && a2enmod rewrite headers \
    && rm -rf /var/lib/apt/lists/*

# Konfigurasi PHP produksi: opcache, tanpa display_errors, tanpa argumen di stack trace.
RUN mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"
COPY docker/php-production.ini "$PHP_INI_DIR/conf.d/zz-digitalin.ini"

# DocumentRoot ke public/ (aturan rewrite ada di public/.htaccess).
COPY docker/apache-site.conf /etc/apache2/sites-available/000-default.conf

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /var/www/html

# Dependensi dulu (layer cache), tanpa paket dev.
COPY composer.json composer.lock ./
RUN composer install --no-dev --optimize-autoloader --no-interaction --no-progress --no-scripts --prefer-dist

COPY . .
RUN mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && composer dump-autoload --no-dev --optimize \
    && chown -R www-data:www-data storage bootstrap/cache \
    && sed -i 's/\r$//' docker/start.sh \
    && chmod +x docker/start.sh

# Render memberi port lewat env PORT (default 10000); start.sh menyesuaikan Apache.
ENV PORT=10000
EXPOSE 10000

CMD ["docker/start.sh"]
