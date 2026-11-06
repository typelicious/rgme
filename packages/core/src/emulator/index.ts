export * from "./embedded.js";
export * from "./placeholder-preview-adapter.js";
export * from "./vamiga-web-adapter.js";
export * from "./emulatorjs-core-adapter.js";
export * from "./copperline-adapter.js";

// Backward-compatibility aliases
export { EmulatorJsCoreAdapter as EmulatorJsPuaeAdapter } from "./emulatorjs-core-adapter.js";
export { VAmigaWebAdapter as WasmEmulatorAdapter } from "./vamiga-web-adapter.js";
