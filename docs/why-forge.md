# Why Forge?

There are already great JavaScript frameworks. So why build another one — and more importantly, why should you use it?

This page gives you an honest answer. Forge isn't the right choice for every project. But for the right project, it hits a combination of qualities that no single existing framework offers.

---

## The short version

| | React | Vue | Angular | **Forge** |
|---|---|---|---|---|
| Reactivity model | State + VDOM diffing | Reactivity + VDOM | Zone.js + change detection | Fine-grained signals, no VDOM |
| Component format | JSX in `.tsx` | SFC in `.vue` | Class + template in separate files | SFC in `.forge` |
| Dependency injection | Context API / hooks | `provide/inject` | Full DI system | Full DI system |
| Bundle size | Medium | Small–medium | Large | Small (compiled output) |
| Build speed | Fast (Vite) | Fast (Vite) | Moderate | Very fast (Rolldown/Rust) |
| TypeScript | Good | Good | Excellent | Excellent |
| Learning curve | Moderate | Low | High | Moderate |
| Enterprise structure | DIY | DIY | Built-in | Built-in |
| Ecosystem | Enormous | Large | Large | Early-stage |

---

## Compared to React

React is the most widely used framework in the world. It has an enormous ecosystem, a massive talent pool, and solves real problems well. You should probably keep using React if:

- You're building a product where hiring React developers is a priority
- You rely heavily on the React ecosystem (Next.js, React Native, etc.)
- Your team is already proficient and productive in React

**Where Forge is different:**

React's mental model is built around re-renders. When state changes, components re-render, and the virtual DOM reconciler figures out what actually changed. This works well, but it has costs: you manage `useMemo`, `useCallback`, and `useEffect` to avoid unnecessary work. Performance problems are real, and the solutions often feel like fighting the framework.

Forge uses fine-grained signals. When `count` changes, only the exact DOM node displaying `count` updates — nothing else runs. There's no reconciler, no re-render cycle, and no dependency arrays to manage.

```ts
// React — you manage memoisation
const doubled = useMemo(() => count * 2, [count]);
useEffect(() => { document.title = `Count: ${count}`; }, [count]);

// Forge — reactivity is automatic
const doubled = computed(() => count() * 2);
effect(() => { document.title = `Count: ${count()}`; });
```

Forge also has a first-class dependency injection system. In React, cross-cutting concerns like auth, logging, and feature flags typically rely on a mix of context, prop drilling, and third-party state libraries. In Forge, services are injectable singletons by default, testable in isolation, and scoped precisely.

**Choose Forge over React when** you want predictable reactivity without memoisation overhead, or when your app has complex service-layer requirements that feel awkward in React's component-centric model.

---

## Compared to Vue

Vue is the friendliest of the major frameworks. Vue 3's Composition API and `<script setup>` SFCs are genuinely excellent. If you love Vue, you will feel at home in Forge — the SFC format is directly inspired by it.

You should probably keep using Vue if:

- Your team already knows and loves Vue
- You want a mature ecosystem with official solutions (Pinia, Vue Router, Nuxt)
- You're building a public-facing product where SEO and SSR matter today

**Where Forge is different:**

Vue's reactivity uses `ref()` and `reactive()` — objects that are tracked via Proxy. Forge's signals are plain functions. This is a subtle difference but it matters:

```ts
// Vue — refs and reactive objects, .value in script
const count = ref(0);
const doubled = computed(() => count.value * 2);

// Forge — signals as functions, consistent in template and script
const count = signal(0);
const doubled = computed(() => count() * 2);
```

More significantly, Vue does not have a built-in dependency injection system designed for services. `provide/inject` works for passing values down a component tree, but it's not built for the kind of singleton application services you see in enterprise apps — things like auth services, HTTP clients, or feature flag managers with their own internal state.

Forge's DI system is designed for exactly this. Services are decorated, lazily instantiated, and can be scoped globally, to a component subtree, or to a custom injector. This makes large application architecture significantly cleaner.

Finally, Forge uses **Rolldown** — a Rust-based bundler — instead of Vite. For small apps the difference is negligible. At enterprise scale (hundreds of components, large dependency graphs), build times are measurably faster.

**Choose Forge over Vue when** your app has a substantial service layer, you prefer a pure signal model over refs/reactive, or build performance is a priority at scale.

---

## Compared to Angular

Angular is the most structurally similar framework to Forge. Both have a real DI system, both are TypeScript-first, and both target enterprise applications. If your team knows Angular, you will recognise many of Forge's patterns immediately.

You should probably keep using Angular if:

- You have a large existing Angular codebase
- You need Angular's mature ecosystem (Angular Material, NgRx, Angular Universal)
- Your team relies on Angular's opinions about everything (forms, HTTP, i18n)

**Where Forge is different:**

Angular's change detection model is based on Zone.js, which monkey-patches browser APIs to detect when anything might have changed, then runs change detection across the component tree. Angular 17 introduced signals as an opt-in alternative, but Zone.js remains the default and the mental model is still largely class-based with lifecycle hooks.

Forge is signals all the way down from day one. There's no Zone.js, no `OnPush` strategy to opt into, no `markForCheck()` calls, no `ngZone.run()` workarounds. Reactivity is the default, not an addition.

```ts
// Angular — class component, zone-based, lifecycle hooks
@Component({ template: `{{ doubled }}` })
export class CounterComponent implements OnInit {
  count = 0;
  doubled = 0;
  ngOnInit() { this.doubled = this.count * 2; }
  increment() { this.count++; this.doubled = this.count * 2; }
}

// Forge — signals, no lifecycle hooks needed
const count = signal(0);
const doubled = computed(() => count() * 2);
function increment() { count.update(n => n + 1); }
```

Angular is also a large framework with a large bundle. Its opinions are comprehensive — which is a strength when you need them and friction when you don't. Forge takes Angular's best idea (dependency injection) and leaves behind the rest of the complexity.

**Choose Forge over Angular when** you want Angular's structural discipline without its runtime weight, or you're starting a new project and don't need the full Angular platform.

---

## When Forge is the right choice

Forge is designed for a specific sweet spot:

- **Enterprise apps** that need real architecture — services, DI, routing — not just components
- **Performance-sensitive UIs** where re-render overhead is unacceptable
- **TypeScript-first teams** who want strict types end-to-end
- **Greenfield projects** where you're not constrained by an existing framework choice
- **Teams who want one less thing to argue about** — Forge's structure is opinionated enough to guide architecture without being prescriptive about everything

---

## When Forge is not the right choice

Be honest with yourself here:

- **You need SSR or SSG today.** Forge doesn't have a server-rendering story yet.
- **Ecosystem depth matters.** React, Vue, and Angular have years of libraries, tools, and tutorials. Forge is early.
- **Your team is React-only.** The signal model and DI system are learnable, but switching has a real onboarding cost.
- **You need mobile.** There's no React Native equivalent for Forge.

---

## The one-paragraph pitch

Forge combines the reactivity model of SolidJS, the component ergonomics of Vue, and the application structure of Angular — compiled to minimal, fast output using a Rust-based bundler. It's for teams who have outgrown the DIY architecture of React or the runtime weight of Angular, and want a framework that makes the right patterns the easy patterns.

If that sounds like your situation, [get started here](../README.md).
