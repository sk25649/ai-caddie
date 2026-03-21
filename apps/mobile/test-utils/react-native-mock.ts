// Minimal react-native mock for vitest — only what's needed in tests
export const Platform = { OS: 'ios', select: (obj: Record<string, unknown>) => obj.ios ?? obj.default };
export const StyleSheet = { create: (s: unknown) => s, flatten: (s: unknown) => s };
export const View = 'View';
export const Text = 'Text';
export const Pressable = 'Pressable';
export const TextInput = 'TextInput';
export const ScrollView = 'ScrollView';
export const FlatList = 'FlatList';
export const Image = 'Image';
export const TouchableOpacity = 'TouchableOpacity';
export const Animated = { Value: class {}, timing: () => ({ start: () => {} }), View: 'Animated.View' };
export const Alert = { alert: () => {} };
export const Vibration = { vibrate: () => {} };
export default {};
