import { useState, useRef, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import { speakVoice } from '../lib/api';

// Module-level cache: text snippet → local file URI
// Persists across renders and hole changes for the lifetime of the app session.
const audioCache = new Map<string, string>();

interface UseElevenLabsVoiceReturn {
  speak: (text: string) => Promise<void>;
  stop: () => void;
  isSpeaking: boolean;
  isLoading: boolean;
}

export function useElevenLabsVoice(): UseElevenLabsVoiceReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const playerRef = useRef<AudioPlayer | null>(null);

  const stop = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.pause();
      playerRef.current.remove();
      playerRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => { stop(); }, [stop]);

  const speak = useCallback(async (text: string) => {
    // Stop anything currently playing
    stop();

    setIsLoading(true);

    try {
      const cacheKey = text.slice(0, 60);
      let uri = audioCache.get(cacheKey);

      if (!uri) {
        const result = await speakVoice(text);
        const filePath = `${FileSystem.cacheDirectory}caddie_voice_${Date.now()}.mp3`;
        await FileSystem.writeAsStringAsync(filePath, result.audio, {
          encoding: 'base64' as FileSystem.EncodingType,
        });
        uri = filePath;
        audioCache.set(cacheKey, uri);
      }

      setIsLoading(false);

      await setAudioModeAsync({ playsInSilentMode: true });
      const player = createAudioPlayer({ uri });
      playerRef.current = player;

      // Wait for the player to finish loading before playing
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Audio load timeout')), 10000);

        player.addListener('playbackStatusUpdate', (status) => {
          if (status.isLoaded && !status.playing && !status.didJustFinish) {
            clearTimeout(timeout);
            resolve();
          }
          if (status.didJustFinish) {
            player.remove();
            playerRef.current = null;
            setIsSpeaking(false);
          }
        });

        // If already loaded (local file), resolve immediately
        if (player.isLoaded) {
          clearTimeout(timeout);
          resolve();
        }
      });

      setIsSpeaking(true);
      player.play();
    } catch (err) {
      console.error('[voice] speak failed:', err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg.includes('503') || msg.includes('Voice unavailable')) {
        Alert.alert('Voice Unavailable', 'ElevenLabs API key not configured on the server.');
      }
      setIsLoading(false);
      setIsSpeaking(false);
    }
  }, [stop]);

  return { speak, stop, isSpeaking, isLoading };
}
