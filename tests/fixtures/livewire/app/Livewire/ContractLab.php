<?php

namespace App\Livewire;

use Illuminate\Contracts\View\View;
use Livewire\Component;

class ContractLab extends Component
{
    public int $revision = 1;

    public string $email = 'before@example.test';

    public string $owner = 'ada';

    public string $code = '';

    public bool $showNested = true;

    /** @var list<string> */
    public array $people = ['ada', 'grace', 'katherine'];

    public function morph(): void
    {
        $this->revision++;
        $this->people = array_reverse($this->people);
    }

    public function toggleNested(): void
    {
        $this->showNested = ! $this->showNested;
        $this->revision++;
    }

    public function render(): View
    {
        return view('livewire.contract-lab');
    }
}
