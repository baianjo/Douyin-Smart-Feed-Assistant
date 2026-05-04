declare function GM_setValue<T>(key: string, value: T): void;
declare function GM_getValue<T>(key: string, defaultValue?: T): any;
declare function GM_deleteValue(key: string): void;
declare function GM_addStyle(css: string): void;
declare function GM_xmlhttpRequest(details: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  data?: string;
  timeout?: number;
  onload?: (response: {
    status: number;
    statusText: string;
    responseText: string;
  }) => void;
  onerror?: (error: {
    status?: number;
    statusText?: string;
    error?: string;
  }) => void;
  ontimeout?: () => void;
}): void;

declare const unsafeWindow: Window & typeof globalThis;

interface HTMLElement {
  value?: string;
  checked?: boolean;
  disabled?: boolean;
  type?: string;
}

interface EventTarget {
  value?: string;
  checked?: boolean;
  tagName?: string;
}
