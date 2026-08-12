function classTokens(value, target = []) {
    if (!value) return target;

    if (typeof value === 'string') {
        target.push(...value.split(/\s+/).filter(Boolean));
    } else if (Array.isArray(value)) {
        value.forEach((entry) => classTokens(entry, target));
    } else if (typeof value === 'object') {
        Object.entries(value).forEach(([token, enabled]) => {
            if (enabled) classTokens(token, target);
        });
    }

    return target;
}

export function mergeClasses(...values) {
    return [...new Set(values.flatMap((value) => classTokens(value)))].join(' ');
}

export function mergeStyles(...values) {
    return values
        .filter(Boolean)
        .map((value) => String(value).trim().replace(/;+$/, ''))
        .filter(Boolean)
        .join('; ');
}

function escapeAttribute(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

export class AttributeBag {
    constructor(attributes = {}) {
        this.attributes = { ...attributes };
    }

    static from(attributes = {}) {
        return attributes instanceof AttributeBag ? attributes.clone() : new AttributeBag(attributes);
    }

    static fromElement(element) {
        return new AttributeBag(Object.fromEntries(
            [...element.attributes].map((attribute) => [attribute.name, attribute.value]),
        ));
    }

    get(name, fallback = null) {
        return Object.hasOwn(this.attributes, name) ? this.attributes[name] : fallback;
    }

    has(name) {
        return Object.hasOwn(this.attributes, name);
    }

    all() {
        return { ...this.attributes };
    }

    entries() {
        return Object.entries(this.attributes);
    }

    clone() {
        return new AttributeBag(this.attributes);
    }

    set(name, value) {
        return new AttributeBag({ ...this.attributes, [name]: value });
    }

    remove(...names) {
        const removed = new Set(names.flat());
        return new AttributeBag(Object.fromEntries(
            this.entries().filter(([name]) => !removed.has(name)),
        ));
    }

    except(...names) {
        return this.remove(...names);
    }

    for(namespace) {
        const prefix = `${namespace}:`;
        return new AttributeBag(Object.fromEntries(
            this.entries()
                .filter(([name]) => name.startsWith(prefix))
                .map(([name, value]) => [name.slice(prefix.length), value]),
        ));
    }

    whereDoesntStartWith(...prefixes) {
        const values = prefixes.flat();
        return new AttributeBag(Object.fromEntries(
            this.entries().filter(([name]) => !values.some((prefix) => name.startsWith(prefix))),
        ));
    }

    merge(defaults = {}) {
        defaults = AttributeBag.from(defaults).all();
        const merged = { ...defaults, ...this.attributes };

        const classes = mergeClasses(defaults.class, this.attributes.class);
        const styles = mergeStyles(defaults.style, this.attributes.style);

        if (classes) merged.class = classes;
        else delete merged.class;

        if (styles) merged.style = styles;
        else delete merged.style;

        return new AttributeBag(merged);
    }

    class(value) {
        return this.set('class', mergeClasses(this.get('class'), value));
    }

    style(value) {
        return this.set('style', mergeStyles(this.get('style'), value));
    }

    boolean(name) {
        if (!this.has(name)) return false;
        return !['false', '0', 'null'].includes(String(this.get(name)).toLowerCase());
    }

    toString() {
        return this.entries()
            .filter(([, value]) => value !== false && value !== null && value !== undefined)
            .map(([name, value]) => value === true || value === ''
                ? name
                : `${name}="${escapeAttribute(value)}"`)
            .join(' ');
    }
}
