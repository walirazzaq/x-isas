import { AttributeBag } from '../../support/attribute-bag.js';

const LIVEWIRE_ALIAS_PREFIX = 'lw:';
const LIVEWIRE_PREFIX = 'wire:';

/**
 * Temporary compatibility for Livewire's unanchored `wire:` attribute matcher.
 *
 * This deliberately operates on an already-scoped native attribute bag. It can
 * therefore be removed without changing the host runtime or AttributeBag.
 */
export function translateNativeLivewireAliases(attributes = {}) {
    const source = AttributeBag.from(attributes);
    let aliases = new AttributeBag();
    const aliasNames = [];

    for (const [name, value] of source.entries()) {
        if (!name.startsWith(LIVEWIRE_ALIAS_PREFIX)) continue;

        aliasNames.push(name);
        aliases = aliases.set(
            `${LIVEWIRE_PREFIX}${name.slice(LIVEWIRE_ALIAS_PREFIX.length)}`,
            value,
        );
    }

    // Canonical wire:* attributes win when both spellings target the same name.
    return source.remove(aliasNames).merge(aliases);
}
