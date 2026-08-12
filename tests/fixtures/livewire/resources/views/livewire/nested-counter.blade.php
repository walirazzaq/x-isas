<article data-testid="nested-counter" class="rounded-box border border-base-300 p-3">
    <span>Nested count <strong data-testid="nested-count">{{ $count }}</strong></span>
    <button x-is="button" size="xs" wire:click="increment" data-testid="nested-increment">Increment nested</button>
</article>
