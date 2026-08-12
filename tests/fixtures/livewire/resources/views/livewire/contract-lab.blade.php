<section data-testid="contract-lab" class="grid gap-5 rounded-box bg-base-100 p-5 shadow">
    <header class="flex flex-wrap items-center gap-3">
        <span x-is="badge" color="primary" wire:key="revision-badge">
            revision <span wire:text="revision" data-testid="revision">{{ $revision }}</span>
        </span>
        <button x-is="button" size="sm" wire:click="morph" data-testid="server-morph">Morph server state</button>
        <button
            x-is="button"
            size="sm"
            variant="outline"
            wire:key="stable-alpine-button"
            x-data="{ clicks: 0 }"
            @click="clicks++"
            data-testid="stable-alpine"
        >
            Alpine <span x-text="clicks">0</span>
        </button>
    </header>

    <div class="grid gap-4 md:grid-cols-3">
        <div>
            <div
                x-is="input-field"
                label="Email"
                native:type="email"
                native:aria-label="Livewire email"
                native:lw:model.live.debounce.100ms="email"
                data-testid="email-field"
            ></div>
            <output data-testid="email-value">{{ $email }}</output>
        </div>

        <div
            x-is="select-field"
            label="Owner"
            name="owner"
            select:placeholder="Choose an owner"
            select:lw:model.live="owner"
            data-testid="owner-field"
        >
            @foreach ($people as $person)
                <div x-is="option" value="{{ $person }}" wire:key="owner-{{ $person }}">
                    {{ ucfirst($person) }}
                </div>
            @endforeach
        </div>
        <output data-testid="owner-value">{{ $owner }}</output>

        <div>
            <label
                x-is="otp"
                length="4"
                native:aria-label="Livewire code"
                native:lw:model.live.debounce.100ms="code"
                data-testid="otp"
            ></label>
            <output data-testid="code-value">{{ $code }}</output>
        </div>
    </div>

    <div class="flex flex-wrap items-start gap-3">
        <button x-is="button" controls-dialog="livewire-dialog" data-testid="dialog-trigger">Open dialog</button>
        <button x-is="button" variant="ghost" wire:click="toggleNested" data-testid="toggle-nested">Toggle nested</button>

        @if ($showNested)
            <livewire:nested-counter wire:key="nested-counter" />
        @endif
    </div>

    @teleport('#fixture-portal')
        <dialog x-is="dialog" id="livewire-dialog" wire:key="stable-dialog" aria-label="Livewire dialog">
            <section x-part="content">
                <p>Dialog revision <span data-testid="dialog-revision">{{ $revision }}</span></p>
                <input aria-label="Dialog draft" value="preserved">
                <button type="button" wire:click="morph" data-testid="dialog-morph">Morph while open</button>
                <button type="button" @click="$dialog.close()" data-testid="dialog-close">Close</button>
            </section>
        </dialog>
    @endteleport
</section>
