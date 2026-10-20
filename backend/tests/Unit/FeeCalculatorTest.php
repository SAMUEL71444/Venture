<?php

use App\Modules\ledger\Services\FeeCalculator;

it('matches the mentor commission simulation table in the design document', function (int $amount, int $platformFee, int $mentor, int $platformNet, int $student) {
    $split = FeeCalculator::milestoneSplit($amount, 1200, 3000, 10000, 1);

    expect($split['platform_fee'])->toBe($platformFee)
        ->and($split['mentor_fee_total'])->toBe($mentor)
        ->and($split['platform_net'])->toBe($platformNet)
        ->and($split['student_amount'])->toBe($student)
        ->and($split['student_amount'] + $split['mentor_fee_total'] + $split['platform_net'])->toBe($amount);
})->with([
    [150000, 18000, 10000, 8000, 132000],
    [300000, 36000, 10800, 25200, 264000],
    [500000, 60000, 18000, 42000, 440000],
    [1000000, 120000, 36000, 84000, 880000],
    [2000000, 240000, 72000, 168000, 1760000],
]);

it('rounds half up in integer rupiah', function () {
    expect(FeeCalculator::percentOf(150001, 1200))->toBe(18000)  // 18.000,12
        ->and(FeeCalculator::percentOf(150005, 1200))->toBe(18001) // 18.000,60
        ->and(FeeCalculator::percentOf(4166625, 1200))->toBe(499995); // 499.995,00
});

it('converts percentages to basis points without floats', function () {
    expect(FeeCalculator::basisPoints('12.00'))->toBe(1200)
        ->and(FeeCalculator::basisPoints('12.5'))->toBe(1250)
        ->and(FeeCalculator::basisPoints(12))->toBe(1200)
        ->and(FeeCalculator::basisPoints('30.00'))->toBe(3000);
});

it('caps the mentor fee at the platform fee', function () {
    expect(FeeCalculator::mentorFee(8000, 3000, 10000))->toBe(8000);
});

it('lets the platform bear extra fees for replaced mentors', function () {
    $split = FeeCalculator::milestoneSplit(150000, 1200, 3000, 10000, 2);

    expect($split['mentor_fees'])->toBe([10000, 10000])
        ->and($split['platform_net'])->toBe(-2000)
        ->and($split['student_amount'])->toBe(132000);
});

it('rejects invalid percentages', function () {
    FeeCalculator::basisPoints('abc');
})->throws(InvalidArgumentException::class);
