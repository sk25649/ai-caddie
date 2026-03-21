import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

let onPlaybackStatusUpdate: ((status: { isLoaded: boolean; didJustFinish: boolean }) => void) | null = null;

const mocks = vi.hoisted(() => {
  const mockPlayAsync = vi.fn().mockResolvedValue(undefined);
  const mockStopAsync = vi.fn().mockResolvedValue(undefined);
  const mockUnloadAsync = vi.fn().mockResolvedValue(undefined);
  const mockSetOnPlaybackStatusUpdate = vi.fn();
  const mockCreateAsync = vi.fn();
  const mockSetAudioMode = vi.fn().mockResolvedValue(undefined);
  const mockWriteAsStringAsync = vi.fn().mockResolvedValue(undefined);
  const mockSpeakVoice = vi.fn().mockResolvedValue({ audio: 'base64audiodata==', format: 'mp3' });

  return {
    mockPlayAsync,
    mockStopAsync,
    mockUnloadAsync,
    mockSetOnPlaybackStatusUpdate,
    mockCreateAsync,
    mockSetAudioMode,
    mockWriteAsStringAsync,
    mockSpeakVoice,
  };
});

vi.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: mocks.mockCreateAsync,
    },
    setAudioModeAsync: mocks.mockSetAudioMode,
  },
}));

vi.mock('expo-file-system', () => ({
  cacheDirectory: '/tmp/cache/',
  writeAsStringAsync: mocks.mockWriteAsStringAsync,
  EncodingType: { Base64: 'base64' },
}));

vi.mock('../../lib/api', () => ({
  speakVoice: mocks.mockSpeakVoice,
}));

import { useElevenLabsVoice } from '../useElevenLabsVoice';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeMockSound() {
  return {
    playAsync: mocks.mockPlayAsync,
    stopAsync: mocks.mockStopAsync,
    unloadAsync: mocks.mockUnloadAsync,
    setOnPlaybackStatusUpdate: vi.fn((cb: (status: { isLoaded: boolean; didJustFinish: boolean }) => void) => {
      onPlaybackStatusUpdate = cb;
    }),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('useElevenLabsVoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onPlaybackStatusUpdate = null;
    // Default createAsync returns a fresh mock sound
    mocks.mockCreateAsync.mockResolvedValue({ sound: makeMockSound() });
    mocks.mockSpeakVoice.mockResolvedValue({ audio: 'base64audiodata==', format: 'mp3' });
    mocks.mockWriteAsStringAsync.mockResolvedValue(undefined);
  });

  it('starts with isSpeaking=false and isLoading=false', () => {
    const { result } = renderHook(() => useElevenLabsVoice());
    expect(result.current.isSpeaking).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('isLoading is false and isSpeaking is true after speak() completes', async () => {
    const { result } = renderHook(() => useElevenLabsVoice());

    await act(async () => {
      await result.current.speak('Test hole unique text loadingcheck abc123');
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isSpeaking).toBe(true);
  });

  it('calls speakVoice API on cache miss and writes file', async () => {
    const { result } = renderHook(() => useElevenLabsVoice());

    await act(async () => {
      await result.current.speak('Unique apicall text xyz987unique');
    });

    expect(mocks.mockSpeakVoice).toHaveBeenCalledWith('Unique apicall text xyz987unique');
    expect(mocks.mockWriteAsStringAsync).toHaveBeenCalledWith(
      expect.stringContaining('.mp3'),
      'base64audiodata==',
      { encoding: 'base64' }
    );
    expect(mocks.mockPlayAsync).toHaveBeenCalled();
  });

  it('does not call speakVoice API on cache hit (same text twice)', async () => {
    const text = 'Cached hole text unique qwerty456unique';
    const { result } = renderHook(() => useElevenLabsVoice());

    await act(async () => { await result.current.speak(text); });

    // Reset mocks but module-level cache still has the entry
    vi.clearAllMocks();
    mocks.mockCreateAsync.mockResolvedValue({ sound: makeMockSound() });

    await act(async () => { await result.current.speak(text); });

    // speakVoice should NOT be called again
    expect(mocks.mockSpeakVoice).not.toHaveBeenCalled();
    expect(mocks.mockPlayAsync).toHaveBeenCalled();
  });

  it('sets isSpeaking=false when playback finishes', async () => {
    const { result } = renderHook(() => useElevenLabsVoice());

    await act(async () => {
      await result.current.speak('Finished playback test unique lmno789');
    });

    // Wait for isSpeaking to become true (React 18 async batching)
    await waitFor(() => expect(result.current.isSpeaking).toBe(true));

    act(() => {
      onPlaybackStatusUpdate?.({ isLoaded: true, didJustFinish: true });
    });

    expect(result.current.isSpeaking).toBe(false);
  });

  it('stop() halts audio and sets isSpeaking=false', async () => {
    const { result } = renderHook(() => useElevenLabsVoice());

    await act(async () => {
      await result.current.speak('Stop test unique text pqrst789');
    });

    // Wait for isSpeaking to become true (React 18 async batching)
    await waitFor(() => expect(result.current.isSpeaking).toBe(true));

    act(() => { result.current.stop(); });

    expect(mocks.mockStopAsync).toHaveBeenCalled();
    expect(mocks.mockUnloadAsync).toHaveBeenCalled();
    expect(result.current.isSpeaking).toBe(false);
  });

  it('handles API errors gracefully — sets both flags to false', async () => {
    mocks.mockSpeakVoice.mockRejectedValueOnce(new Error('Voice unavailable'));
    const { result } = renderHook(() => useElevenLabsVoice());

    await act(async () => {
      await result.current.speak('Error case unique text uvwxy456');
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isSpeaking).toBe(false);
  });
});
