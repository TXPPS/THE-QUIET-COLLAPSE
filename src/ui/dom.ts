type Child = Node | string | null | undefined | false;

export interface ElOptions {
  class?: string;
  text?: string;
  attrs?: Record<string, string>;
  html?: never;
}

/** Tiny element factory. Text is always assigned through textContent, never innerHTML. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, options: ElOptions = {}, children: Child[] = []): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.class) node.className = options.class;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.attrs) for (const [key, value] of Object.entries(options.attrs)) node.setAttribute(key, value);
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

export function toggleClass(node: HTMLElement, className: string, on: boolean): void {
  if (node.classList.contains(className) !== on) node.classList.toggle(className, on);
}

export function setHidden(node: HTMLElement, hidden: boolean): void {
  if (node.hidden !== hidden) node.hidden = hidden;
}

/** Pointer capture can throw when the pointer is already gone (or synthetic); never let that abort input. */
export function capturePointer(element: Element, pointerId: number): void {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // The gesture continues without capture; handlers still clean up on pointerup/cancel.
  }
}
