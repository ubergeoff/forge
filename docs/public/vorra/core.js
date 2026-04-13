
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
const pendingEffects = new Set();
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
function signal(initialValue, options) {
	const node = {
		value: initialValue,
		subscribers: new Set(),
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
		const ro = () => {
			trackDep(node);
			return node.value;
		};
		Object.defineProperty(ro, "__type", { value: "signal" });
		return ro;
	};
	return writableSignal;
}
function computed(compute, options) {
	const node = {
		dirty: true,
		value: undefined,
		deps: new Set(),
		compute,
		subscribers: new Set(),
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
				if (node.value === undefined || !node.equals(node.value, newValue)) node.value = newValue;
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
function effect(fn) {
	const node = {
		fn,
		cleanup: undefined,
		deps: new Set(),
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
		node.cleanup = undefined;
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
const INJECTABLE_META = new WeakMap();
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
var InjectionToken = class {
	__tokenType;
	id;
	description;
	options;
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
const CIRCULAR = Symbol("CIRCULAR");
var Injector = class Injector$1 {
	instances = new Map();
	resolving = new Set();
	providers = new Map();
	constructor(providers = [], parent = null) {
		this.parent = parent;
		for (const p of providers) this.providers.set(p.provide, p);
	}
	get(token, optional = false) {
		const result = this.resolve(token);
		if (result === NOT_FOUND) {
			if (optional) return null;
			throw new Error(`[Forge DI] No provider found for ${tokenName(token)}. ` + `Did you forget @Injectable() or to add it to your providers array?`);
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
			const deps$1 = (provider.deps ?? []).map((dep) => this.get(dep));
			return provider.useFactory(...deps$1);
		}
		const deps = (provider.deps ?? []).map((dep) => this.get(dep));
		return new provider.useClass(...deps);
	}
	instantiateClass(ctor, deps) {
		const resolved = deps.map((dep) => this.get(dep));
		return new ctor(...resolved);
	}
	resolveProvidedIn(providedIn) {
		if (providedIn === "root") return getRootInjector();
		if (providedIn === "component") return this;
		if (providedIn instanceof Injector$1) return providedIn;
		return null;
	}
	/**
	* Creates a child injector that inherits from this one.
	* Child providers shadow parent providers for the same token.
	*/
	createChild(providers = []) {
		return new Injector$1(providers, this);
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
function bootstrapApp(providers = []) {
	_rootInjector = new Injector(providers);
	return _rootInjector;
}
function resetRootInjector() {
	_rootInjector?.destroy();
	_rootInjector = null;
}
/**
* The active injector context for inject() calls.
* Set during component/service instantiation.
*/
let activeInjector = null;
function runInContext(injector, fn) {
	const prev = activeInjector;
	activeInjector = injector;
	try {
		return fn();
	} finally {
		activeInjector = prev;
	}
}
function getActiveInjector() {
	return activeInjector;
}
function inject(token, options = {}) {
	if (!activeInjector) throw new Error(`[Forge DI] inject() called outside of an injection context. ` + `inject() can only be used during component or service construction.`);
	return activeInjector.get(token, options.optional);
}
function tokenName(token) {
	if (token instanceof InjectionToken) return token.toString();
	if (typeof token === "function") return token.name || "(anonymous class)";
	return String(token);
}
function onDestroy(fn) {
	if (!activeInjector) throw new Error("[Forge DI] onDestroy() must be called within an injection context.");
	const token = new InjectionToken(`__destroyRef__`);
	getOrCreateDestroyRef(activeInjector).callbacks.push(fn);
}
const destroyRefs = new WeakMap();
function getOrCreateDestroyRef(injector) {
	if (!destroyRefs.has(injector)) destroyRefs.set(injector, { callbacks: [] });
	return destroyRefs.get(injector);
}
function runDestroyCallbacks(injector) {
	const ref = destroyRefs.get(injector);
	if (ref) {
		for (const cb of ref.callbacks) cb();
		ref.callbacks = [];
	}
}

//#endregion
//#region ../packages/core/dist/dom.js
function createElement(tag) {
	return document.createElement(tag);
}
function setAttr(el, name, value) {
	el.setAttribute(name, value);
}
function setProp(el, name, value) {
	el[name] = value;
}
function listen(el, event, handler) {
	el.addEventListener(event, handler);
	return { destroy() {
		el.removeEventListener(event, handler);
	} };
}
function insert(parent, child, anchor) {
	parent.insertBefore(child, anchor ?? null);
}
function remove(node) {
	node.parentNode?.removeChild(node);
}
function bindText(node, getter) {
	return effect(() => {
		node.nodeValue = getter();
	});
}
function bindAttr(el, name, getter) {
	return effect(() => {
		const value = getter();
		if (value === null) el.removeAttribute(name);
else el.setAttribute(name, value);
	});
}
function bindProp(el, name, getter) {
	return effect(() => {
		el[name] = getter();
	});
}
function bindShow(el, getter) {
	return effect(() => {
		el.style.display = getter() ? "" : "none";
	});
}
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
function createComponent(parentInjector, providers) {
	const injector = parentInjector.createChild(providers ?? []);
	return {
		injector,
		effects: [],
		children: []
	};
}
function destroyComponent(ctx) {
	for (const child of ctx.children) destroyComponent(child);
	ctx.children.length = 0;
	for (const handle of ctx.effects) handle.destroy();
	ctx.effects.length = 0;
	ctx.injector.destroy();
}
function mountComponent(factory, container, ctx) {
	const node = factory(ctx);
	container.appendChild(node);
}
function mountChild(factory, parentCtx, props = {}) {
	const childCtx = createComponent(parentCtx.injector);
	parentCtx.children.push(childCtx);
	return factory(childCtx, props);
}

//#endregion
export { Inject, Injectable, InjectionToken, Injector, batch, bindAttr, bindClass, bindProp, bindShow, bindText, bootstrapApp, computed, createComponent, createElement, destroyComponent, effect, getActiveInjector, getRootInjector, inject, insert, isSignal, listen, mountChild, mountComponent, onDestroy, remove, resetRootInjector, runDestroyCallbacks, runInContext, setAttr, setProp, signal, untrack };