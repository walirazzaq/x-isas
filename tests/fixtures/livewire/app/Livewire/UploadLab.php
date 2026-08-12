<?php

namespace App\Livewire;

use Illuminate\Contracts\View\View;
use Livewire\Component;
use Livewire\WithFileUploads;

class UploadLab extends Component
{
    use WithFileUploads;

    /** @var array<int, mixed> */
    public array $files = [];

    /** @var list<string> */
    public array $saved = [];

    public function save(): void
    {
        $this->validate([
            'files' => ['required', 'array', 'max:2'],
            'files.*' => ['file', 'max:256'],
        ]);

        $this->saved = array_map(
            static fn ($file): string => $file->getClientOriginalName(),
            $this->files,
        );
    }

    public function render(): View
    {
        return view('livewire.upload-lab');
    }
}
