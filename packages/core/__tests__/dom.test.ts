// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { signal } from '../src/reactivity.js';
import {
  createElement,
  setAttr,
  setProp,
  listen,
  insert,
  remove,
  bindText,
  bindAttr,
  bindProp,
  bindShow,
  bindClass,
  createComponent,
  destroyComponent,
  mountComponent,
} from '../src/dom.js';
import { bootstrapApp, resetRootInjector } from '../src/di.js';

beforeEach(() => {
  resetRootInjector();
});

// ---------------------------------------------------------------------------
// Element creation & patching
// ---------------------------------------------------------------------------

describe('createElement', () => {
  it('creates an element with the given tag', () => {
    const el = createElement('div');
    expect(el.tagName.toLowerCase()).toBe('div');
  });

  it('creates different element types', () => {
    expect(createElement('span').tagName.toLowerCase()).toBe('span');
    expect(createElement('button').tagName.toLowerCase()).toBe('button');
    expect(createElement('input').tagName.toLowerCase()).toBe('input');
  });
});

describe('setAttr', () => {
  it('sets an attribute on an element', () => {
    const el = createElement('div');
    setAttr(el, 'id', 'main');
    expect(el.getAttribute('id')).toBe('main');
  });

  it('sets multiple attributes', () => {
    const el = createElement('input');
    setAttr(el, 'type', 'text');
    setAttr(el, 'placeholder', 'Enter text');
    expect(el.getAttribute('type')).toBe('text');
    expect(el.getAttribute('placeholder')).toBe('Enter text');
  });
});

describe('setProp', () => {
  it('sets a DOM property directly', () => {
    const input = createElement('input') as HTMLInputElement;
    setProp(input, 'value', 'hello');
    expect(input.value).toBe('hello');
  });

  it('sets boolean properties', () => {
    const input = createElement('input') as HTMLInputElement;
    setProp(input, 'disabled', true);
    expect(input.disabled).toBe(true);
  });
});

describe('listen', () => {
  it('attaches an event listener', () => {
    const el = createElement('button');
    let clicked = false;
    listen(el, 'click', () => { clicked = true; });
    el.dispatchEvent(new Event('click'));
    expect(clicked).toBe(true);
  });

  it('removes the listener when handle is destroyed', () => {
    const el = createElement('button');
    let count = 0;
    const handle = listen(el, 'click', () => { count++; });
    el.dispatchEvent(new Event('click'));
    expect(count).toBe(1);
    handle.destroy();
    el.dispatchEvent(new Event('click'));
    expect(count).toBe(1); // did not increment
  });
});

describe('insert', () => {
  it('appends a child to a parent', () => {
    const parent = createElement('div');
    const child = createElement('span');
    insert(parent, child);
    expect(parent.firstChild).toBe(child);
  });

  it('inserts before an anchor node', () => {
    const parent = createElement('div');
    const first = createElement('span');
    const second = createElement('span');
    insert(parent, first);
    insert(parent, second, first);
    expect(parent.firstChild).toBe(second);
    expect(parent.lastChild).toBe(first);
  });
});

describe('remove', () => {
  it('removes a node from its parent', () => {
    const parent = createElement('div');
    const child = createElement('span');
    insert(parent, child);
    expect(parent.childNodes.length).toBe(1);
    remove(child);
    expect(parent.childNodes.length).toBe(0);
  });

  it('does nothing when node has no parent', () => {
    const el = createElement('div');
    expect(() => remove(el)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Reactive bindings
// ---------------------------------------------------------------------------

describe('bindText', () => {
  it('sets the initial text content from the getter', () => {
    const count = signal(42);
    const node = document.createTextNode('');
    const handle = bindText(node, () => String(count()));
    expect(node.nodeValue).toBe('42');
    handle.destroy();
  });

  it('updates text when signal changes', () => {
    const name = signal('Alice');
    const node = document.createTextNode('');
    const handle = bindText(node, () => name());
    expect(node.nodeValue).toBe('Alice');
    name.set('Bob');
    expect(node.nodeValue).toBe('Bob');
    handle.destroy();
  });

  it('stops updating after handle is destroyed', () => {
    const val = signal('before');
    const node = document.createTextNode('');
    const handle = bindText(node, () => val());
    handle.destroy();
    val.set('after');
    expect(node.nodeValue).toBe('before');
  });
});

describe('bindAttr', () => {
  it('sets the initial attribute value', () => {
    const cls = signal('active');
    const el = createElement('div');
    const handle = bindAttr(el, 'class', () => cls());
    expect(el.getAttribute('class')).toBe('active');
    handle.destroy();
  });

  it('updates attribute when signal changes', () => {
    const href = signal('/home');
    const el = createElement('a');
    const handle = bindAttr(el, 'href', () => href());
    href.set('/about');
    expect(el.getAttribute('href')).toBe('/about');
    handle.destroy();
  });

  it('removes the attribute when getter returns null', () => {
    const val = signal<string | null>('yes');
    const el = createElement('div');
    const handle = bindAttr(el, 'disabled', () => val());
    expect(el.getAttribute('disabled')).toBe('yes');
    val.set(null);
    expect(el.hasAttribute('disabled')).toBe(false);
    handle.destroy();
  });
});

describe('bindProp', () => {
  it('sets the initial property value', () => {
    const val = signal('initial');
    const input = createElement('input') as HTMLInputElement;
    const handle = bindProp(input, 'value', () => val());
    expect(input.value).toBe('initial');
    handle.destroy();
  });

  it('updates property when signal changes', () => {
    const checked = signal(false);
    const input = createElement('input') as HTMLInputElement;
    const handle = bindProp(input, 'checked', () => checked());
    expect(input.checked).toBe(false);
    checked.set(true);
    expect(input.checked).toBe(true);
    handle.destroy();
  });
});

describe('bindShow', () => {
  it('shows element when getter returns true', () => {
    const visible = signal(true);
    const el = createElement('div') as HTMLElement;
    const handle = bindShow(el, () => visible());
    expect((el as HTMLElement).style.display).toBe('');
    handle.destroy();
  });

  it('hides element when getter returns false', () => {
    const visible = signal(false);
    const el = createElement('div') as HTMLElement;
    const handle = bindShow(el, () => visible());
    expect((el as HTMLElement).style.display).toBe('none');
    handle.destroy();
  });

  it('toggles visibility reactively', () => {
    const visible = signal(true);
    const el = createElement('div') as HTMLElement;
    const handle = bindShow(el, () => visible());
    expect((el as HTMLElement).style.display).toBe('');
    visible.set(false);
    expect((el as HTMLElement).style.display).toBe('none');
    visible.set(true);
    expect((el as HTMLElement).style.display).toBe('');
    handle.destroy();
  });
});

describe('bindClass', () => {
  it('adds classes that are true in the initial record', () => {
    const el = createElement('div');
    const handle = bindClass(el, () => ({ active: true, disabled: false }));
    expect(el.classList.contains('active')).toBe(true);
    expect(el.classList.contains('disabled')).toBe(false);
    handle.destroy();
  });

  it('adds and removes classes reactively', () => {
    const isActive = signal(false);
    const el = createElement('div');
    const handle = bindClass(el, () => ({ active: isActive() }));
    expect(el.classList.contains('active')).toBe(false);
    isActive.set(true);
    expect(el.classList.contains('active')).toBe(true);
    isActive.set(false);
    expect(el.classList.contains('active')).toBe(false);
    handle.destroy();
  });

  it('handles classes being removed from the record', () => {
    const showExtra = signal(true);
    const el = createElement('div');
    const handle = bindClass(el, () =>
      showExtra() ? { base: true, extra: true } : { base: true }
    );
    expect(el.classList.contains('extra')).toBe(true);
    showExtra.set(false);
    expect(el.classList.contains('extra')).toBe(false);
    expect(el.classList.contains('base')).toBe(true);
    handle.destroy();
  });
});

// ---------------------------------------------------------------------------
// Component lifecycle
// ---------------------------------------------------------------------------

describe('createComponent', () => {
  it('creates a context with an injector, effects array, and children array', () => {
    const app = bootstrapApp();
    const ctx = createComponent(app);
    expect(ctx.injector).toBeDefined();
    expect(Array.isArray(ctx.effects)).toBe(true);
    expect(Array.isArray(ctx.children)).toBe(true);
    destroyComponent(ctx);
    app.destroy();
  });

  it('creates a child injector scoped to the parent', () => {
    const app = bootstrapApp();
    const ctx = createComponent(app);
    // Child injector can resolve from parent.
    expect(ctx.injector).not.toBe(app);
    destroyComponent(ctx);
    app.destroy();
  });
});

describe('destroyComponent', () => {
  it('destroys all owned effects', () => {
    const count = signal(0);
    const app = bootstrapApp();
    const ctx = createComponent(app);

    let runs = 0;
    const handle = bindText(document.createTextNode(''), () => {
      count(); // subscribe
      runs++;
      return String(count());
    });
    ctx.effects.push(handle);

    const runsBefore = runs;
    count.set(1);
    expect(runs).toBe(runsBefore + 1);

    destroyComponent(ctx);

    count.set(2);
    expect(runs).toBe(runsBefore + 1); // no additional runs
    app.destroy();
  });

  it('recursively destroys child contexts', () => {
    const app = bootstrapApp();
    const parent = createComponent(app);
    const child = createComponent(parent.injector);
    parent.children.push(child);

    const count = signal(0);
    let childRuns = 0;
    child.effects.push(
      bindText(document.createTextNode(''), () => {
        count();
        childRuns++;
        return '';
      })
    );

    const before = childRuns;
    count.set(1);
    expect(childRuns).toBe(before + 1);

    destroyComponent(parent);

    count.set(2);
    expect(childRuns).toBe(before + 1); // child effects stopped
    app.destroy();
  });
});

describe('mountComponent', () => {
  it('inserts the factory return value into the container', () => {
    const app = bootstrapApp();
    const ctx = createComponent(app);
    const container = createElement('div');

    mountComponent(
      () => {
        const el = createElement('span');
        setAttr(el, 'id', 'mounted');
        return el;
      },
      container,
      ctx
    );

    expect(container.querySelector('#mounted')).not.toBeNull();
    destroyComponent(ctx);
    app.destroy();
  });
});
