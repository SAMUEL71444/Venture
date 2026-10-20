<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubmissionFile extends Model
{
    use HasUuids;

    protected $fillable = [
        'submission_id',
        'file_url',
        'file_name',
        'mime_type',
        'size_bytes',
    ];

    /** Path private storage tidak diekspos; unduh lewat endpoint yang mengecek akses. */
    protected $hidden = ['file_url'];

    protected function casts(): array
    {
        return [
            'size_bytes' => 'integer',
        ];
    }

    public function submission(): BelongsTo
    {
        return $this->belongsTo(Submission::class, 'submission_id');
    }
}
