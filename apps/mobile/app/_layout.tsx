import '../global.css';
import React, { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000,
    },
  },
});

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0a1a0a', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ color: '#d4a843', fontSize: 20, fontFamily: 'serif', marginBottom: 12 }}>
            Something went wrong
          </Text>
          <Text style={{ color: '#b8a888', textAlign: 'center', marginBottom: 24, lineHeight: 22 }}>
            The app hit an unexpected error. Tap below to restart.
          </Text>
          <Pressable
            onPress={() => this.setState({ hasError: false })}
            style={{ paddingVertical: 14, paddingHorizontal: 32, backgroundColor: '#d4a843', borderRadius: 12 }}
          >
            <Text style={{ color: '#0a1a0a', fontWeight: '600', fontSize: 16 }}>Try Again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  const init = useAuthStore((s) => s.init);
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    init().finally(() => SplashScreen.hideAsync());
  }, [init]);

  if (isLoading) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#0a1a0a' },
            animation: 'slide_from_right',
          }}
        />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
