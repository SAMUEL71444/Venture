<?php

namespace App\Shared\Database;

/**
 * Pencarian "mengandung" yang berperilaku sama di SQLite dan PostgreSQL:
 * tanpa beda huruf besar/kecil, dan % _ ! \ dari input diperlakukan sebagai teks biasa.
 *
 * Karakter escape sengaja '!' (bukan backslash): literal '\' di SQL membuat parser
 * placeholder PDO pgsql menganggap kutipnya belum ditutup, sehingga placeholder
 * sesudahnya hilang (SQLSTATE[HY093] Invalid parameter number).
 */
final class LikeSearch
{
    public const ESCAPE = '!';

    /** Potongan SQL untuk whereRaw: "LOWER(<column>) LIKE ? ESCAPE '!'". */
    public static function sql(string $column): string
    {
        return "LOWER({$column}) LIKE ? ESCAPE '".self::ESCAPE."'";
    }

    /** Pola "%<input>%" dengan input di-lowercase dan ! % _ di-escape. */
    public static function containsPattern(string $input): string
    {
        $escape = self::ESCAPE;

        return '%'.strtr(mb_strtolower($input), [
            $escape => $escape.$escape,
            '%' => $escape.'%',
            '_' => $escape.'_',
        ]).'%';
    }
}
