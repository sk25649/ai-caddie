import { useState, useRef, useEffect, useCallback } from 'react';
import { Audio } from 'expo-av';
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
  const soundRef = useRef<Audio.Sound | null>(null);

  const stop = useCallback(() => {
    if (soundRef.current) {
      soundRef.current.stopAsync().catch(() => {});
      soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
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
          encoding: FileSystem.EncodingType.Base64,
        });
        uri = filePath;
        audioCache.set(cacheKey, uri);
      }

      setIsLoading(false);

      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri });
      soundRef.current = sound;
      setIsSpeaking(true);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          soundRef.current = null;
          setIsSpeaking(false);
        }
      });

      await sound.playAsync();
    } catch {
      setIsLoading(false);
      setIsSpeaking(false);
    }
  }, [stop]);

  return { speak, stop, isSpeaking, isLoading };
}
