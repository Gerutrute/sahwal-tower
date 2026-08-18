export const RUNTIME_CONFIG_SCRIPT_TAG: string;
export function validateGameConfigText(text: unknown): any;
export function renderRuntimeConfigJs(config: unknown, target: string): string;
export function injectRuntimeConfigScript(html: string): string;
