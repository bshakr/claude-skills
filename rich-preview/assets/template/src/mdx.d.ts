declare module "*.mdx" {
  import type { ComponentType } from "react";

  const component: ComponentType<Record<string, unknown>>;
  export default component;
}

declare module "*.md?raw" {
  const source: string;
  export default source;
}
