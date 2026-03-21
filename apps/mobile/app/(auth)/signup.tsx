import { View, Text, Pressable, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { signup, ApiError } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export default function SignupScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!email.includes('@')) e.email = 'Enter a valid email';
    if (password.length < 8) e.password = 'Must be at least 8 characters';
    if (password !== confirm) e.confirm = 'Passwords don\'t match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSignup = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const result = await signup(email, password);
      setAuth(result.token, result.userId);
      router.replace('/onboarding/basics');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Signup failed';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-green-deep px-6 justify-center">
      <View className="items-center mb-10">
        <Text className="text-[13px] tracking-[4px] uppercase text-gold font-semibold mb-2">
          AI Caddie
        </Text>
        <Text className="text-3xl text-white" style={{ fontFamily: 'serif' }}>
          Create Account
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
      <Input
        label="Confirm Password"
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        error={errors.confirm}
        accessibilityLabel="Confirm password"
      />

      <Button title="Create Account" onPress={handleSignup} loading={loading} className="mt-2" />

      <Pressable onPress={() => router.back()} className="mt-6 items-center">
        <Text className="text-cream-dim text-base">
          Already have an account?{' '}
          <Text className="text-gold font-semibold">Log In</Text>
        </Text>
      </Pressable>
    </View>
  );
}
