// Minimal React 19 typings used when @types/react is not installed (offline builds).
// With `npm install`, the real @types/react can replace this file.
declare namespace React {
  type ReactNode = ReactElement | string | number | bigint | boolean | null | undefined | Iterable<ReactNode>;
  interface ReactElement { type: unknown; props: unknown; key: string | null }
  type Key = string | number;
  type SetStateAction<S> = S | ((prev: S) => S);
  type Dispatch<A> = (value: A) => void;
  interface RefObject<T> { current: T }
  type Ref<T> = RefObject<T | null> | ((instance: T | null) => void) | null;
  type FC<P = {}> = (props: P) => ReactNode;
  interface SyntheticEvent<T = Element> { currentTarget: T; target: EventTarget & T; preventDefault(): void; stopPropagation(): void }
  interface ChangeEvent<T = Element> extends SyntheticEvent<T> { target: EventTarget & T }
  interface FormEvent<T = Element> extends SyntheticEvent<T> {}
  interface MouseEvent<T = Element> extends SyntheticEvent<T> { clientX: number; clientY: number }
  interface KeyboardEvent<T = Element> extends SyntheticEvent<T> { key: string; shiftKey: boolean }
  interface ClipboardEvent<T = Element> extends SyntheticEvent<T> { clipboardData: DataTransfer }
  interface FocusEvent<T = Element> extends SyntheticEvent<T> {}
  interface CSSProperties { [key: string]: string | number | undefined }
}

declare module 'react' {
  export = React;
  export as namespace React;
}
declare module 'react' {
  export type ReactNode = React.ReactNode;
  export type FC<P = {}> = React.FC<P>;
  export type CSSProperties = React.CSSProperties;
  export type RefObject<T> = React.RefObject<T>;
  export type ChangeEvent<T = Element> = React.ChangeEvent<T>;
  export type FormEvent<T = Element> = React.FormEvent<T>;
  export type KeyboardEvent<T = Element> = React.KeyboardEvent<T>;
  export type MouseEvent<T = Element> = React.MouseEvent<T>;
  export type ClipboardEvent<T = Element> = React.ClipboardEvent<T>;
  export function useState<S>(initial: S | (() => S)): [S, React.Dispatch<React.SetStateAction<S>>];
  export function useState<S = undefined>(): [S | undefined, React.Dispatch<React.SetStateAction<S | undefined>>];
  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useLayoutEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useMemo<T>(factory: () => T, deps: readonly unknown[]): T;
  export function useCallback<T extends (...args: any[]) => any>(cb: T, deps: readonly unknown[]): T;
  export function useRef<T>(initial: T): React.RefObject<T>;
  export function useRef<T>(initial: T | null): React.RefObject<T | null>;
  export function useId(): string;
  export function useReducer<S, A>(reducer: (s: S, a: A) => S, init: S): [S, React.Dispatch<A>];
  export function useSyncExternalStore<T>(subscribe: (cb: () => void) => () => void, get: () => T, getServer?: () => T): T;
  export function createContext<T>(value: T): { Provider: React.FC<{ value: T; children?: React.ReactNode }> };
  export function useContext<T>(ctx: { Provider: React.FC<{ value: T; children?: React.ReactNode }> }): T;
  export const Fragment: React.FC<{ children?: React.ReactNode; key?: React.Key }>;
  export const StrictMode: React.FC<{ children?: React.ReactNode }>;
}

declare module 'react-dom/client' {
  export function createRoot(el: Element): { render(node: React.ReactNode): void; unmount(): void };
}

declare module 'react/jsx-runtime' {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}

declare module '*.css';

interface ShimDOMAttrs {
  ref?: React.Ref<any>;
  key?: React.Key;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent<any>) => void;
  onChange?: (e: React.ChangeEvent<any>) => void;
  onInput?: (e: React.ChangeEvent<any>) => void;
  onKeyDown?: (e: React.KeyboardEvent<any>) => void;
  onSubmit?: (e: React.FormEvent<any>) => void;
  onFocus?: (e: React.FocusEvent<any>) => void;
  onBlur?: (e: React.FocusEvent<any>) => void;
  onError?: (e: React.SyntheticEvent<any>) => void;
  [attr: string]: any;
}

declare namespace JSX {
  type Element = React.ReactElement;
  interface ElementChildrenAttribute { children: {} }
  interface IntrinsicAttributes { key?: React.Key }
  interface IntrinsicElements { [tag: string]: ShimDOMAttrs }
}
