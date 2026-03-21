// Minimal expo-modules-core mock for vitest
export const NativeModulesProxy = {};
export const EventEmitter = class {};
export const requireNativeModule = () => ({});
export const requireOptionalNativeModule = () => null;
export const CodedError = class extends Error {};
export const uuid = { v4: () => 'mock-uuid' };
export default {};
