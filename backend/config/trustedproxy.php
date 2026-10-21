<?php

return [

    /*
    | Proxy yang dipercaya untuk header X-Forwarded-* (dibaca middleware TrustProxies bawaan).
    | Render menaruh aplikasi di belakang load balancer dengan IP yang berubah-ubah, jadi
    | di Render isi TRUSTED_PROXIES=* agar IP klien (rate limit, audit) dan skema https benar.
    | Kosong (default lokal) = tidak ada proxy yang dipercaya. Bisa juga daftar IP/CIDR dipisah koma.
    */
    'proxies' => env('TRUSTED_PROXIES'),

];
