import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

let onPlaybackStatusUpdate: ((status: { didJustFinish: boolean }) => void) | null = null;

const mocks = vi.hoisted(() => {
  const mockPlay = vi.fn();
  const mockPause = vi.fn();
  const mockRemove = vi.fn();
  const mockAddListener = vi.fn();
  const mockCreateAudioPlayer = vi.fn();
  const mockSetAudioMode = vi.fn().mockResolvedValue(undefined);
  const mockWriteAsStringAsync = vi.fn().mockResolvedValue(undefined);
  const mockSpeakVoice = vi.fn().mockResolvedValue({ audio: 'base64audiodata==', format: 'mp3' });

  return {
    mockPlay,
    mockPause,
    mockRemove,
    mockAddListener,
    mockCreateAudioPlayer,
    mockSetAudioMode,
    mockWriteAsStringAsync,
    mockSpeakVoice,
  };
});

vi.mock('expo-audio', () => ({
  createAudioPlayer: mocks.mockCreateAudioPlayer,
  setAudioModeAsync: mocks.mockSetAudioMode,
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

function makeMockPlayer() {
  return {
    play: mocks.mockPlay,
    pause: mocks.mockPause,
    remove: mocks.mockRemove,
    isLoaded: true, // local files load immediately
    addListener: vi.fn((event: string, cb: (status: { didJustFinish: boolean }) => void) => {
      if (event === 'playbackStatusUpdate') {
        onPlaybackStatusUpdate = cb;
      }
    }),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('useElevenLabsVoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onPlaybackStatusUpdate = null;
    mocks.mockCreateAudioPlayer.mockReturnValue(makeMockPlayer());
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
    expect(mocks.mockPlay).toHaveBeenCalled();
  });

  it('does not call speakVoice API on cache hit (same text twice)', async () => {
    const text = 'Cached hole text unique qwerty456unique';
    const { result } = renderHook(() => useElevenLabsVoice());

    await act(async () => { await result.current.speak(text); });

    vi.clearAllMocks();
    mocks.mockCreateAudioPlayer.mockReturnValue(makeMockPlayer());

    await act(async () => { await result.current.speak(text); });

    // speakVoice should NOT be called again
    expect(mocks.mockSpeakVoice).not.toHaveBeenCalled();
    expect(mocks.mockPlay).toHaveBeenCalled();
  });

  it('sets isSpeaking=false when playback finishes', async () => {
    const { result } = renderHook(() => useElevenLabsVoice());

    await act(async () => {
      await result.current.speak('Finished playback test unique lmno789');
    });

    await waitFor(() => expect(result.current.isSpeaking).toBe(true));

    act(() => {
      onPlaybackStatusUpdate?.({ didJustFinish: true });
    });

    expect(result.current.isSpeaking).toBe(false);
  });

  it('stop() halts audio and sets isSpeaking=false', async () => {
    const { result } = renderHook(() => useElevenLabsVoice());

    await act(async () => {
      await result.current.speak('Stop test unique text pqrst789');
    });

    await waitFor(() => expect(result.current.isSpeaking).toBe(true));

    act(() => { result.current.stop(); });

    expect(mocks.mockPause).toHaveBeenCalled();
    expect(mocks.mockRemove).toHaveBeenCalled();
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
