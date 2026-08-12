<form wire:submit="save" data-testid="upload-lab" class="grid gap-3 rounded-box bg-base-100 p-5 shadow">
    <div
        x-is="file-upload"
        wire:model="files"
        wire:key="livewire-upload"
        multiple
        accept=".txt,text/plain"
        max-files="2"
        label="Contract files"
        data-testid="livewire-upload"
    ></div>

    <output data-testid="temporary-count">{{ count($files) }}</output>
    <button x-is="button" type="submit" size="sm">Save files</button>

    @if ($saved)
        <output data-testid="saved-files">{{ implode(', ', $saved) }}</output>
    @endif
</form>
