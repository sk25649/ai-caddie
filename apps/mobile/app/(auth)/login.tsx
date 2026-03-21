import { View, Text, Pressable, Alert, Platform } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuthStore } from '../../stores/authStore';
import { login, appleSignIn, ApiError } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export default function LoginScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = (): boolean => {
    const e: typeof errors = {};
    if (!email.includes('@')) e.email = 'Enter a valid email';
    if (password.length < 1) e.password = 'Enter your password';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const result = await login(email, password);
      setAuth(result.token, result.userId);
      router.replace('/');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Login failed';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const fullName = credential.fullName
        ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
        : undefined;

      const result = await appleSignIn(
        credential.user,
        credential.email || undefined,
        fullName || undefined
      );

      setAuth(result.token, result.userId);
      router.replace('/');
    } catch (err: unknown) {
      // Ignore user cancellation; surface everything else
      const isCancel = err && typeof err === 'object' && 'code' in err &&
        (err as { code: string }).code === 'ERR_REQUEST_CANCELED';
      if (!isCancel) {
        const message = err instanceof ApiError ? err.message : 'Apple Sign-In failed';
        Alert.alert('Error', message);
      }
    }
  };

  return (
    <View className="flex-1 bg-green-deep px-6 justify-center">
      <View className="items-center mb-10">
        <Text className="text-xs tracking-[5px] uppercase text-gold font-semibold mb-2">
          AI Caddie
        </Text>
        <Text className="text-3xl text-white" style={{ fontFamily: 'serif' }}>
          Welcome Back
        </Text>
      </View>

      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        error={errors.email}
        accessibilityLabel="Email address"
      />
      <Input
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        error={errors.password}
        accessibilityLabel="Password"
      />

      <Button title="Log In" onPress={handleLogin} loading={loading} className="mt-2" />

      {Platform.OS === 'ios' && (
        <View className="mt-6">
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE}
            cornerRadius={12}
            style={{ height: 50 }}
            onPress={handleAppleSignIn}
          />
        </View>
      )}

      <Pressable onPress={() => router.push('/(auth)/signup')} className="mt-6 items-center">
        <Text className="text-cream-dim text-base">
          Don't have an account?{' '}
          <Text className="text-gold font-semibold">Sign Up</Text>
        </Text>
      </Pressable>
    </View>
  );
}
