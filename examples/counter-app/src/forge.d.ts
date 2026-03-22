declare module '*.forge' {
  import type { ComponentContext } from '@forge/core/dom';
  export default function(ctx: ComponentContext): Node;
}
