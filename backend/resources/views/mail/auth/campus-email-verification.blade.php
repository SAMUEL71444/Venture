<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Verifikasi email kampus Digital.in</title>
</head>
<body style="margin:0;padding:24px;background:#F6F9FC;font-family:Arial,Helvetica,sans-serif;color:#0F172A;">
    <div style="max-width:480px;margin:0 auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px;padding:28px;">
        <p style="margin:0 0 16px;font-size:18px;font-weight:700;">Digital.in</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Klik tombol di bawah untuk memverifikasi email kampusmu dan menyelesaikan verifikasi status mahasiswa.</p>
        <p style="margin:0 0 20px;text-align:center;">
            <a href="{{ $url }}" style="display:inline-block;padding:12px 24px;background:#2563EB;color:#FFFFFF;border-radius:8px;font-weight:700;text-decoration:none;">Verifikasi email kampus</a>
        </p>
        <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">Tautan berlaku {{ $ttlMinutes }} menit dan hanya dapat digunakan sekali.</p>
        <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#64748B;">Jika tombol tidak berfungsi, salin tautan ini ke browser:<br><span style="word-break:break-all;">{{ $url }}</span></p>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#64748B;">Jika kamu tidak merasa mendaftar di Digital.in, abaikan saja email ini.</p>
    </div>
</body>
</html>
