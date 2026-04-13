//#region ../packages/core/dist/reactivity.js
/**
* The currently-executing reactive context (effect or computed).
* When a signal is read, it registers itself as a dependency of this context.
*/
let activeContext = null;
/**
* Batch depth counter. When > 0, signal writes are queued rather than
* flushed immediately.
*/
let batchDepth = 0;
/** Queue of effects to re-run after the current batch completes. */
const pendingEffects = /* @__PURE__ */ new Set();
function trackDep(node) {
	if (activeContext === null) return;
	node.subscribers.add(activeContext);
	activeContext.deps.add(node);
}
function unsubscribeContext(ctx) {
	for (const dep of ctx.deps) dep.subscribers.delete(ctx);
	ctx.deps.clear();
}
function notifySubscribers(node) {
	for (const sub of [...node.subscribers]) sub.notify();
}
/**
* Groups multiple signal writes into a single flush, preventing intermediate
* effect executions. Effects only run once after the outermost batch ends.
*
* @example
* batch(() => {
*   firstName.set('Jane');
*   lastName.set('Doe');
* });
* // Effects depending on either signal run exactly once.
*/
function batch(fn) {
	batchDepth++;
	try {
		fn();
	} finally {
		batchDepth--;
		if (batchDepth === 0) flushEffects();
	}
}
function flushEffects() {
	while (pendingEffects.size > 0) {
		const snapshot = [...pendingEffects];
		pendingEffects.clear();
		for (const node of snapshot) if (!node.destroyed) runEffect(node);
	}
}
function scheduleEffect(node) {
	if (node.scheduled || node.destroyed) return;
	node.scheduled = true;
	pendingEffects.add(node);
	if (batchDepth === 0) flushEffects();
}
/**
* Creates a reactive signal — a piece of state that automatically notifies
* any effects or computed values that read it when it changes.
*
* @example
* const count = signal(0);
* count();           // read → 0
* count.set(1);      // write
* count.update(n => n + 1);  // functional update
*/
function signal(initialValue, options) {
	const node = {
		value: initialValue,
		subscribers: /* @__PURE__ */ new Set(),
		equals: options?.equals ?? Object.is
	};
	function getter() {
		trackDep(node);
		return node.value;
	}
	function setter(value) {
		if (node.equals(node.value, value)) return;
		node.value = value;
		notifySubscribers(node);
	}
	const writableSignal = getter;
	Object.defineProperty(writableSignal, "__type", { value: "signal" });
	writableSignal.set = setter;
	writableSignal.update = (fn) => {
		setter(fn(node.value));
	};
	writableSignal.asReadonly = () => {
		const ro = (() => {
			trackDep(node);
			return node.value;
		});
		Object.defineProperty(ro, "__type", { value: "signal" });
		return ro;
	};
	return writableSignal;
}
/**
* Creates a lazily-evaluated derived value. Re-evaluates only when one of
* its signal dependencies changes, and only when read.
*
* @example
* const count = signal(2);
* const doubled = computed(() => count() * 2);
* doubled(); // → 4
*/
function computed(compute, options) {
	const node = {
		dirty: true,
		value: void 0,
		deps: /* @__PURE__ */ new Set(),
		compute,
		subscribers: /* @__PURE__ */ new Set(),
		equals: options?.equals ?? Object.is,
		notify() {
			if (!node.dirty) {
				node.dirty = true;
				notifySubscribers(node);
			}
		}
	};
	function getter() {
		if (activeContext !== null) {
			node.subscribers.add(activeContext);
			activeContext.deps.add(node);
		}
		if (node.dirty) {
			unsubscribeContext(node);
			const prevContext = activeContext;
			activeContext = node;
			try {
				const newValue = compute();
				if (node.value === void 0 || !node.equals(node.value, newValue)) node.value = newValue;
			} finally {
				activeContext = prevContext;
				node.dirty = false;
			}
		}
		return node.value;
	}
	const computedSignal = getter;
	Object.defineProperty(computedSignal, "__type", { value: "signal" });
	return computedSignal;
}
/**
* Runs a side-effect function immediately and re-runs it whenever any signal
* read inside it changes.
*
* The function may optionally return a cleanup function that runs before the
* next execution or when the effect is destroyed.
*
* @returns An EffectHandle with a `destroy()` method to stop the effect.
*
* @example
* const count = signal(0);
* const handle = effect(() => {
*   console.log('count is', count());
*   return () => console.log('cleanup');
* });
* handle.destroy(); // stops the effect
*/
function effect(fn) {
	const node = {
		fn,
		cleanup: void 0,
		deps: /* @__PURE__ */ new Set(),
		scheduled: false,
		destroyed: false,
		notify() {
			scheduleEffect(node);
		}
	};
	runEffect(node);
	return { destroy() {
		if (node.destroyed) return;
		node.destroyed = true;
		if (typeof node.cleanup === "function") node.cleanup();
		unsubscribeContext(node);
		pendingEffects.delete(node);
	} };
}
function runEffect(node) {
	if (node.destroyed) return;
	if (typeof node.cleanup === "function") {
		node.cleanup();
		node.cleanup = void 0;
	}
	unsubscribeContext(node);
	node.scheduled = false;
	const prevContext = activeContext;
	activeContext = node;
	try {
		node.cleanup = node.fn();
	} finally {
		activeContext = prevContext;
	}
}
/**
* Reads signals inside `fn` without registering them as dependencies of the
* current reactive context. Useful for reading state in an effect without
* creating subscriptions.
*
* @example
* effect(() => {
*   triggerSignal(); // subscribed
*   const val = untrack(() => otherSignal()); // NOT subscribed
* });
*/
function untrack(fn) {
	const prevContext = activeContext;
	activeContext = null;
	try {
		return fn();
	} finally {
		activeContext = prevContext;
	}
}
function isSignal(value) {
	return typeof value === "function" && value.__type === "signal";
}
//#endregion
//#region ../packages/core/dist/di.js
const INJECTABLE_META = /* @__PURE__ */ new WeakMap();
/**
* Marks a class as injectable and configures where it is provided.
*
* @example
* \@Injectable({ providedIn: 'root' })
* class UserService {
*   readonly users = signal<User[]>([]);
* }
*/
function Injectable(options = {}) {
	return (target) => {
		const ctor = target;
		const existing = INJECTABLE_META.get(ctor);
		INJECTABLE_META.set(ctor, {
			providedIn: options.providedIn ?? "root",
			deps: existing?.deps ?? []
		});
	};
}
/**
* Declares the constructor dependencies for a class, enabling DI without
* TypeScript decorator metadata (emitDecoratorMetadata).
*
* @example
* \@Injectable({ providedIn: 'root' })
* \@Inject([HttpClient, AuthService])
* class UserService {
*   constructor(private http: HttpClient, private auth: AuthService) {}
* }
*/
function Inject(deps) {
	return (target) => {
		const ctor = target;
		const existing = INJECTABLE_META.get(ctor);
		if (existing) existing.deps = deps;
		else INJECTABLE_META.set(ctor, {
			providedIn: "root",
			deps
		});
	};
}
let tokenIdCounter = 0;
/**
* A typed token used to inject values that aren't class instances — configs,
* primitives, interfaces, or abstract types.
*
* @example
* const API_URL = new InjectionToken<string>('API_URL', {
*   providedIn: 'root',
*   factory: () => 'https://api.example.com',
* });
*
* // Later:
* const url = inject(API_URL); // → 'https://api.example.com'
*/
var InjectionToken = class {
	constructor(description, options) {
		this.id = ++tokenIdCounter;
		this.description = description;
		this.options = options;
	}
	toString() {
		return `InjectionToken(${this.description})`;
	}
};
const NOT_FOUND = Symbol("NOT_FOUND");
/**
* A hierarchical container that resolves and caches provider instances.
* Child injectors delegate to their parent when a token isn't found locally.
*/
var Injector = class Injector {
	constructor(providers = [], parent = null) {
		this.parent = parent;
		this.instances = /* @__PURE__ */ new Map();
		this.resolving = /* @__PURE__ */ new Set();
		this.providers = /* @__PURE__ */ new Map();
		for (const p of providers) this.providers.set(p.provide, p);
	}
	get(token, optional = false) {
		const result = this.resolve(token);
		if (result === NOT_FOUND) {
			if (optional) return null;
			throw new Error(`[Forge DI] No provider found for ${tokenName(token)}. Did you forget @Injectable() or to add it to your providers array?`);
		}
		return result;
	}
	resolve(token) {
		if (this.instances.has(token)) return this.instances.get(token);
		if (this.resolving.has(token)) throw new Error(`[Forge DI] Circular dependency detected while resolving ${tokenName(token)}.`);
		const provider = this.providers.get(token);
		if (provider) {
			this.resolving.add(token);
			try {
				const instance = this.instantiate(provider);
				this.instances.set(token, instance);
				return instance;
			} finally {
				this.resolving.delete(token);
			}
		}
		if (token instanceof InjectionToken && token.options?.factory) {
			const instance = runInContext(this, token.options.factory);
			this.instances.set(token, instance);
			return instance;
		}
		if (typeof token === "function") {
			const meta = INJECTABLE_META.get(token);
			if (meta) {
				const targetInjector = this.resolveProvidedIn(meta.providedIn);
				if (targetInjector === this) {
					this.resolving.add(token);
					try {
						const instance = this.instantiateClass(token, meta.deps);
						this.instances.set(token, instance);
						return instance;
					} finally {
						this.resolving.delete(token);
					}
				} else if (targetInjector) return targetInjector.resolve(token);
			}
		}
		if (this.parent) return this.parent.resolve(token);
		return NOT_FOUND;
	}
	instantiate(provider) {
		if ("useValue" in provider) return provider.useValue;
		if ("useExisting" in provider) return this.get(provider.useExisting);
		if ("useFactory" in provider) {
			const deps = (provider.deps ?? []).map((dep) => this.get(dep));
			return provider.useFactory(...deps);
		}
		const deps = (provider.deps ?? []).map((dep) => this.get(dep));
		return new provider.useClass(...deps);
	}
	instantiateClass(ctor, deps) {
		return new ctor(...deps.map((dep) => this.get(dep)));
	}
	resolveProvidedIn(providedIn) {
		if (providedIn === "root") return getRootInjector();
		if (providedIn === "component") return this;
		if (providedIn instanceof Injector) return providedIn;
		return null;
	}
	/**
	* Creates a child injector that inherits from this one.
	* Child providers shadow parent providers for the same token.
	*/
	createChild(providers = []) {
		return new Injector(providers, this);
	}
	/**
	* Destroys this injector — calls onDestroy() on any instances that
	* implement it, then clears all cached instances.
	*/
	destroy() {
		for (const instance of this.instances.values()) if (instance !== null && typeof instance === "object" && typeof instance.onDestroy === "function") instance.onDestroy();
		this.instances.clear();
		this.providers.clear();
	}
};
let _rootInjector = null;
function getRootInjector() {
	if (!_rootInjector) _rootInjector = new Injector();
	return _rootInjector;
}
/**
* Bootstraps the application by creating the root injector with the given
* providers. Should be called once at app startup.
*
* @example
* bootstrapApp([
*   { provide: API_URL, useValue: 'https://api.example.com' },
* ]);
*/
function bootstrapApp(providers = []) {
	_rootInjector = new Injector(providers);
	return _rootInjector;
}
/** Resets the root injector — primarily useful in tests. */
function resetRootInjector() {
	_rootInjector?.destroy();
	_rootInjector = null;
}
/**
* The active injector context for inject() calls.
* Set during component/service instantiation.
*/
let activeInjector = null;
/**
* Runs a function within a specific injector context, making inject() calls
* inside resolve against that injector.
*/
function runInContext(injector, fn) {
	const prev = activeInjector;
	activeInjector = injector;
	try {
		return fn();
	} finally {
		activeInjector = prev;
	}
}
/**
* Returns the currently active injector, or null if called outside an
* injection context.
*/
function getActiveInjector() {
	return activeInjector;
}
function inject(token, options = {}) {
	if (!activeInjector) throw new Error("[Forge DI] inject() called outside of an injection context. inject() can only be used during component or service construction.");
	return activeInjector.get(token, options.optional);
}
function tokenName(token) {
	if (token instanceof InjectionToken) return token.toString();
	if (typeof token === "function") return token.name || "(anonymous class)";
	return String(token);
}
/**
* Registers a cleanup callback to run when the injector that owns this
* service instance is destroyed.
*
* Call this inside a service constructor (within an injection context).
*
* @example
* \@Injectable({ providedIn: 'root' })
* class WebSocketService {
*   #ws: WebSocket;
*   constructor() {
*     this.#ws = new WebSocket('wss://...');
*     onDestroy(() => this.#ws.close());
*   }
* }
*/
function onDestroy(fn) {
	if (!activeInjector) throw new Error("[Forge DI] onDestroy() must be called within an injection context.");
	new InjectionToken(`__destroyRef__`);
	getOrCreateDestroyRef(activeInjector).callbacks.push(fn);
}
const destroyRefs = /* @__PURE__ */ new WeakMap();
function getOrCreateDestroyRef(injector) {
	if (!destroyRefs.has(injector)) destroyRefs.set(injector, { callbacks: [] });
	return destroyRefs.get(injector);
}
/**
* Runs all onDestroy callbacks registered against an injector.
* Called automatically by Injector.destroy(), but also exported for
* use in the component runtime.
*/
function runDestroyCallbacks(injector) {
	const ref = destroyRefs.get(injector);
	if (ref) {
		for (const cb of ref.callbacks) cb();
		ref.callbacks = [];
	}
}
//#endregion
//#region ../packages/core/dist/dom.js
/**
* Creates a DOM element with the given tag name.
*
* @example
* const div = createElement('div');
*/
function createElement(tag) {
	return document.createElement(tag);
}
/**
* Sets a static attribute on an element.
*
* @example
* setAttr(el, 'class', 'container');
*/
function setAttr(el, name, value) {
	el.setAttribute(name, value);
}
/**
* Sets a DOM property directly (e.g. value, checked, disabled).
*
* @example
* setProp(input, 'value', 'hello');
*/
function setProp(el, name, value) {
	el[name] = value;
}
/**
* Attaches an event listener and returns an EffectHandle to remove it.
*
* @example
* const handle = listen(btn, 'click', () => count.update(n => n + 1));
* handle.destroy(); // removes listener
*/
function listen(el, event, handler) {
	el.addEventListener(event, handler);
	return { destroy() {
		el.removeEventListener(event, handler);
	} };
}
/**
* Inserts a child node into a parent, optionally before an anchor node.
*
* @example
* insert(container, textNode);
* insert(list, item, anchor); // insert before anchor
*/
function insert(parent, child, anchor) {
	parent.insertBefore(child, anchor ?? null);
}
/**
* Removes a node from the DOM.
*
* @example
* remove(el);
*/
function remove(node) {
	node.parentNode?.removeChild(node);
}
/**
* Binds a getter to a Text node's content. The text updates surgically
* whenever the getter's signal dependencies change.
*
* @example
* const t = document.createTextNode('');
* bindText(t, () => String(count()));
*/
function bindText(node, getter) {
	return effect(() => {
		node.nodeValue = getter();
	});
}
/**
* Binds a getter to an element attribute. When the getter returns `null`,
* the attribute is removed.
*
* @example
* bindAttr(el, 'disabled', () => isDisabled() ? '' : null);
*/
function bindAttr(el, name, getter) {
	return effect(() => {
		const value = getter();
		if (value === null) el.removeAttribute(name);
		else el.setAttribute(name, value);
	});
}
/**
* Binds a getter to a DOM property. Updates the property directly whenever
* the getter's signal dependencies change.
*
* @example
* bindProp(input, 'value', () => name());
*/
function bindProp(el, name, getter) {
	return effect(() => {
		el[name] = getter();
	});
}
/**
* Binds a getter to element visibility. When the getter returns `false`,
* `display: none` is applied; otherwise the inline style is cleared.
*
* @example
* bindShow(el, () => isVisible());
*/
function bindShow(el, getter) {
	return effect(() => {
		el.style.display = getter() ? "" : "none";
	});
}
/**
* Binds a getter to a set of CSS classes. Each key in the record is a class
* name; when the value is `true` the class is added, when `false` it is
* removed. Classes not in the record are left untouched.
*
* @example
* bindClass(el, () => ({ active: isActive(), disabled: isDisabled() }));
*/
function bindClass(el, getter) {
	let prevClasses = {};
	return effect(() => {
		const next = getter();
		for (const name of Object.keys(prevClasses)) if (prevClasses[name] === true && !next[name]) el.classList.remove(name);
		for (const [name, active] of Object.entries(next)) if (active) el.classList.add(name);
		else el.classList.remove(name);
		prevClasses = next;
	});
}
/**
* Reactively renders a list of items before an anchor comment node.
* Each item receives its own `ComponentContext` scoped under `parentCtx`
* so that bindings created inside the item template are properly cleaned
* up whenever the list re-renders.
*
* This is the runtime backing for the `@for` template directive.
*
* @example
* // Generated by: <li @for={item of items()}>…</li>
* const anchor = document.createComment('for');
* insert(container, anchor);
* ctx.effects.push(bindList(anchor, ctx, () => items(), (item, i, itemCtx) => {
*   const li = createElement('li');
*   const t = document.createTextNode('');
*   itemCtx.effects.push(bindText(t, () => item.name));
*   insert(li, t);
*   return li;
* }));
*/
function bindList(anchor, parentCtx, getter, itemFactory) {
	let activeItems = [];
	return effect(() => {
		const list = getter();
		const parent = anchor.parentNode;
		if (!parent) return;
		for (const { node, ctx } of activeItems) {
			parent.removeChild(node);
			const idx = parentCtx.children.indexOf(ctx);
			if (idx >= 0) parentCtx.children.splice(idx, 1);
			destroyComponent(ctx);
		}
		activeItems = [];
		for (let i = 0; i < list.length; i++) {
			const itemCtx = createComponent(parentCtx.injector);
			parentCtx.children.push(itemCtx);
			const node = itemFactory(list[i], i, itemCtx);
			parent.insertBefore(node, anchor);
			activeItems.push({
				node,
				ctx: itemCtx
			});
		}
	});
}
/**
* Creates a ComponentContext scoped to a child injector derived from
* `parentInjector`. The context owns all EffectHandles created during
* the component's lifetime.
*
* @example
* const ctx = createComponent(app, [{ provide: MY_TOKEN, useValue: 42 }]);
*/
function createComponent(parentInjector, providers) {
	return {
		injector: parentInjector.createChild(providers ?? []),
		effects: [],
		children: []
	};
}
/**
* Tears down a ComponentContext: destroys all child contexts recursively,
* then destroys all owned effects, then destroys the injector.
*
* @example
* destroyComponent(ctx);
*/
function destroyComponent(ctx) {
	for (const child of ctx.children) destroyComponent(child);
	ctx.children.length = 0;
	for (const handle of ctx.effects) handle.destroy();
	ctx.effects.length = 0;
	ctx.injector.destroy();
}
/**
* Mounts a compiled component factory into a container element. The factory
* receives the ComponentContext, builds the DOM subtree, and returns the
* root node which is then appended to the container.
*
* @example
* mountComponent(counterFactory, document.getElementById('app')!, ctx);
*/
function mountComponent(factory, container, ctx) {
	const node = factory(ctx);
	container.appendChild(node);
}
/**
* Instantiates a child component inside a parent's template. Creates a child
* ComponentContext scoped under the parent, registers it for lifecycle
* tracking, invokes the factory with the given props, and returns the root
* DOM node so the caller can insert it into the tree.
*
* Props are always passed as getter functions so both static and reactive
* values share a uniform call-site API: `props['label']()`.
*
* @example
* // In a compiled parent template:
* const _e1 = mountChild(MyButton, ctx, { label: () => 'Click me' });
* insert(_e0, _e1);
*/
function mountChild(factory, parentCtx, props = {}) {
	const childCtx = createComponent(parentCtx.injector);
	parentCtx.children.push(childCtx);
	const node = factory(childCtx, props);
	const hmrId = factory["__hmrId"];
	if (hmrId) {
		const hmr = (typeof window !== "undefined" ? window : null)?.["__forge_hmr"];
		if (hmr?.instances) {
			const list = hmr.instances.get(hmrId) ?? [];
			list.push({
				node,
				ctx: childCtx,
				props,
				parentCtx
			});
			hmr.instances.set(hmrId, list);
		}
	}
	return node;
}
/**
* Replaces all mounted instances of the component identified by `id` with
* the output of `newFactory`. Called by the HMR client when a `.vorra` chunk
* is hot-updated. Not intended for use in application code.
*/
function hmrAccept(id, newFactory) {
	const hmr = (typeof window !== "undefined" ? window : null)?.["__forge_hmr"];
	if (!hmr?.instances) return;
	const instances = hmr.instances.get(id) ?? [];
	for (const inst of instances) {
		const parent = inst.node.parentNode;
		if (!parent) continue;
		const nextSibling = inst.node.nextSibling;
		destroyComponent(inst.ctx);
		parent.removeChild(inst.node);
		const newCtx = createComponent(inst.parentCtx.injector);
		const idx = inst.parentCtx.children.indexOf(inst.ctx);
		if (idx >= 0) inst.parentCtx.children[idx] = newCtx;
		const newNode = newFactory(newCtx, inst.props);
		parent.insertBefore(newNode, nextSibling);
		inst.node = newNode;
		inst.ctx = newCtx;
	}
}
if (typeof __forge_dev !== "undefined" && __forge_dev && typeof window !== "undefined") {
	const w = window;
	if (!w["__forge_hmr"]) w["__forge_hmr"] = {};
	const hmr = w["__forge_hmr"];
	if (!hmr["instances"]) hmr["instances"] = /* @__PURE__ */ new Map();
	hmr["accept"] = hmrAccept;
}
//#endregion
export { Inject, Injectable, InjectionToken, Injector, batch, bindAttr, bindClass, bindList, bindProp, bindShow, bindText, bootstrapApp, computed, createComponent, createElement, destroyComponent, effect, getActiveInjector, getRootInjector, inject, insert, isSignal, listen, mountChild, mountComponent, onDestroy, remove, resetRootInjector, runDestroyCallbacks, runInContext, setAttr, setProp, signal, untrack };
