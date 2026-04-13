
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
function unsubscribeContext(ctx) {
	for (const dep of ctx.deps) dep.subscribers.delete(ctx);
	ctx.deps.clear();
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
export { bindAttr, bindClass, bindProp, bindShow, bindText, createComponent, createElement, destroyComponent, insert, listen, mountChild, mountComponent, remove, setAttr, setProp };