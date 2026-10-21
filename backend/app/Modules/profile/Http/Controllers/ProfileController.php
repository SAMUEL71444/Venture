<?php

namespace App\Modules\profile\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\MentorProfile;
use App\Models\PortfolioItem;
use App\Models\ServiceCategory;
use App\Models\StudentProfile;
use App\Models\UmkmProfile;
use App\Models\University;
use App\Modules\auth\Http\Resources\AuthUserResource;
use App\Modules\profile\Http\Resources\OwnProfileResource;
use App\Shared\Exceptions\BusinessRuleViolation;
use App\Shared\Http\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

final class ProfileController extends Controller
{
    public function me(Request $request)
    {
        $user = $request->user();
        $profile = match ($user->role) {
            'UMKM' => $user->umkmProfile,
            'STUDENT' => $user->studentProfile?->load('university'),
            'MENTOR' => $user->mentorProfile?->load('expertises'),
            default => null,
        };

        return ApiResponse::success([
            'user' => new AuthUserResource($user),
            'profile' => $profile ? new OwnProfileResource($profile) : null,
        ]);
    }

    public function update(Request $request)
    {
        $user = $request->user();

        $profile = match ($user->role) {
            'UMKM' => $this->updateUmkm($request, $user->umkmProfile),
            'STUDENT' => $this->updateStudent($request, $user->studentProfile),
            'MENTOR' => $this->updateMentor($request, $user->mentorProfile),
            default => throw new BusinessRuleViolation('This account does not have an editable profile.'),
        };

        return ApiResponse::success(['user' => new AuthUserResource($user->fresh()), 'profile' => new OwnProfileResource($profile)]);
    }

    public function universities()
    {
        return ApiResponse::success(University::query()
            ->orderBy('name')
            ->get(['id', 'name', 'short_name', 'city']));
    }

    public function categories()
    {
        return ApiResponse::success(ServiceCategory::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'slug']));
    }

    public function updateSkills(Request $request)
    {
        $input = $request->validate([
            'skills' => ['required', 'array', 'min:1', 'max:100'],
            'skills.*.category_id' => ['required', 'uuid', 'distinct', 'exists:service_categories,id'],
            'skills.*.level' => ['required', 'in:BEGINNER,INTERMEDIATE,ADVANCED'],
        ]);

        $profile = $request->user()->studentProfile;

        DB::transaction(function () use ($profile, $input) {
            $profile->skills()->detach();
            $profile->skills()->attach(collect($input['skills'])->mapWithKeys(
                fn (array $skill) => [$skill['category_id'] => ['level' => $skill['level']]],
            )->all());
        });

        return ApiResponse::success(['skills' => $profile->fresh()->skills]);
    }

    public function student(Request $request, StudentProfile $student)
    {
        // Profil publik hanya untuk mahasiswa terverifikasi yang akunnya aktif (bukan SUSPENDED) — audit F24.
        abort_unless($student->verification_status === 'VERIFIED' && $student->user()->value('status') === 'ACTIVE', 404);
        $student->load(['user:id,name,role', 'university:id,name,city', 'skills', 'portfolioItems']);

        return ApiResponse::success([
            'id' => $student->id,
            'name' => $student->user->name,
            'major' => $student->major,
            'semester' => $student->semester,
            'bio' => $student->bio,
            'rating_avg' => $student->rating_avg,
            'completed_contracts_count' => $student->completed_contracts_count,
            'university' => $student->university,
            'skills' => $student->skills,
            'portfolio' => $student->portfolioItems,
        ]);
    }

    public function students(Request $request)
    {
        $input = $request->validate([
            'category_id' => ['nullable', 'uuid', 'exists:service_categories,id'],
            'city' => ['nullable', 'string', 'max:120'],
            'rating_min' => ['nullable', 'numeric', 'between:0,5'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $query = StudentProfile::query()
            ->where('verification_status', 'VERIFIED')
            ->where('is_available', true)
            ->whereHas('user', fn ($users) => $users->where('status', 'ACTIVE'))
            ->with(['user:id,name,role', 'university:id,name,city', 'skills', 'portfolioItems']);

        if (! empty($input['category_id'])) {
            $query->whereHas('skills', fn ($skills) => $skills->where('service_categories.id', $input['category_id']));
        }

        if (! empty($input['city'])) {
            $query->whereHas('university', fn ($universities) => $universities->where('city', $input['city']));
        }

        if (isset($input['rating_min'])) {
            $query->where('rating_avg', '>=', $input['rating_min']);
        }

        $students = $query->orderByDesc('rating_avg')->paginate(20);

        return ApiResponse::success($students->getCollection()->map(fn (StudentProfile $student) => [
            'id' => $student->id,
            'name' => $student->user->name,
            'major' => $student->major,
            'semester' => $student->semester,
            'rating_avg' => $student->rating_avg,
            'university' => $student->university,
            'skills' => $student->skills,
        ])->all(), [
            'current_page' => $students->currentPage(),
            'last_page' => $students->lastPage(),
            'per_page' => $students->perPage(),
            'total' => $students->total(),
        ]);
    }

    public function createPortfolio(Request $request)
    {
        $input = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:4000'],
            'media_urls' => ['nullable', 'array', 'max:20'],
            'media_urls.*' => ['url', 'max:2048'],
        ]);

        $portfolio = PortfolioItem::query()->create([
            ...$input,
            'student_id' => $request->user()->studentProfile->id,
            'is_verified' => false,
        ]);

        return ApiResponse::success($portfolio, [], 201);
    }

    public function mentorAvailability(Request $request)
    {
        $input = $request->validate(['is_available' => ['required', 'boolean']]);
        $profile = $request->user()->mentorProfile;
        $profile->is_available = $input['is_available'];
        $profile->save();

        return ApiResponse::success(['is_available' => $profile->is_available]);
    }

    private function updateUmkm(Request $request, ?UmkmProfile $profile): UmkmProfile
    {
        if ($profile === null) {
            abort(404);
        }
        $input = $request->validate([
            'business_name' => ['sometimes', 'required', 'string', 'max:255'],
            'business_type' => ['sometimes', 'nullable', 'string', 'max:255'],
            'address' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'city' => ['sometimes', 'nullable', 'string', 'max:120'],
            'latitude' => ['sometimes', 'nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['sometimes', 'nullable', 'numeric', 'between:-180,180'],
            'instagram_url' => ['sometimes', 'nullable', 'url', 'max:255'],
        ]);
        $profile->update($input);

        return $profile->refresh();
    }

    private function updateStudent(Request $request, ?StudentProfile $profile): StudentProfile
    {
        if ($profile === null) {
            abort(404);
        }
        $input = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'nim' => ['sometimes', 'nullable', 'string', 'max:80'],
            'major' => ['sometimes', 'nullable', 'string', 'max:255'],
            'semester' => ['sometimes', 'nullable', 'integer', 'between:1,20'],
            'bio' => ['sometimes', 'nullable', 'string', 'max:4000'],
            'is_available' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('name', $input)) {
            $request->user()->update(['name' => $input['name']]);
            unset($input['name']);
        }
        $profile->update($input);

        return $profile->refresh();
    }

    private function updateMentor(Request $request, ?MentorProfile $profile): MentorProfile
    {
        if ($profile === null) {
            abort(404);
        }
        $input = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'institution' => ['sometimes', 'required', 'string', 'max:255'],
            'bio' => ['sometimes', 'nullable', 'string', 'max:4000'],
            'is_available' => ['sometimes', 'boolean'],
            // Keahlian mentor dipakai penugasan review per kategori (audit F27, ERD MENTOR_EXPERTISES).
            'expertise_category_ids' => ['sometimes', 'array', 'max:50'],
            'expertise_category_ids.*' => ['uuid', 'distinct', Rule::exists('service_categories', 'id')->where('is_active', true)],
        ]);

        DB::transaction(function () use ($request, $profile, $input) {
            if (array_key_exists('name', $input)) {
                $request->user()->update(['name' => $input['name']]);
                unset($input['name']);
            }
            if (array_key_exists('expertise_category_ids', $input)) {
                $profile->expertises()->sync($input['expertise_category_ids']);
                unset($input['expertise_category_ids']);
            }
            $profile->update($input);
        });

        return $profile->refresh()->load('expertises');
    }
}
