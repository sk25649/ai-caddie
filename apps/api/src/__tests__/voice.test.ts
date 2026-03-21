import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeToken, TEST_USER_ID } from './helpers';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../db', () => ({ db: mockDb }));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { voiceRoutes } from '../routes/voice';

// ── Helpers ────────────────────────────────────────────────────────────────

async function post(text: string, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return voiceRoutes.request('/speak', {
    method: 'POST',
    headers,
    body: JSON.stringify({ text }),
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('POST /voice/speak', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no API key
    delete process.env.ELEVENLABS_API_KEY;
    delete process.env.ELEVENLABS_VOICE_ID;
  });

  it('returns 503 when ELEVENLABS_API_KEY is not set', async () => {
    const token = await makeToken(TEST_USER_ID);
    const res = await post('Hello from the fairway', token);
    expect(res.status).toBe(503);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Voice unavailable');
  });

  it('returns 401 without auth token', async () => {
    process.env.ELEVENLABS_API_KEY = 'test-key';
    const res = await post('Hello');
    expect(res.status).toBe(401);
  });

  it('returns 400 for empty text', async () => {
    process.env.ELEVENLABS_API_KEY = 'test-key';
    const token = await makeToken(TEST_USER_ID);
    const res = await post('', token);
    expect(res.status).toBe(400);
  });

  it('returns 400 for text exceeding 2000 chars', async () => {
    process.env.ELEVENLABS_API_KEY = 'test-key';
    const token = await makeToken(TEST_USER_ID);
    const res = await post('a'.repeat(2001), token);
    expect(res.status).toBe(400);
  });

  it('returns base64 audio on successful ElevenLabs call', async () => {
    process.env.ELEVENLABS_API_KEY = 'test-key';
    const bytes = new Uint8Array([0x49, 0x44, 0x33, 0x04]); // fake MP3 header bytes
    const arrayBuf = bytes.buffer;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => arrayBuf,
    });

    const token = await makeToken(TEST_USER_ID);
    const res = await post('Aim left of the bunker', token);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { audio: string; format: string } };
    expect(body.data.format).toBe('mp3');
    expect(body.data.audio).toBe(Buffer.from(arrayBuf).toString('base64'));
  });

  it('uses ELEVENLABS_VOICE_ID env var when set', async () => {
    process.env.ELEVENLABS_API_KEY = 'test-key';
    process.env.ELEVENLABS_VOICE_ID = 'custom-voice-id';
    const bytes = new Uint8Array([1, 2, 3]);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => bytes.buffer,
    });

    const token = await makeToken(TEST_USER_ID);
    await post('Test', token);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('custom-voice-id'),
      expect.any(Object)
    );
  });

  it('returns 503 when ElevenLabs returns non-OK status', async () => {
    process.env.ELEVENLABS_API_KEY = 'test-key';
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => 'rate limit exceeded',
    });

    const token = await makeToken(TEST_USER_ID);
    const res = await post('Test text', token);
    expect(res.status).toBe(503);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Voice unavailable');
  });

  it('returns 503 when fetch throws', async () => {
    process.env.ELEVENLABS_API_KEY = 'test-key';
    mockFetch.mockRejectedValueOnce(new Error('network failure'));

    const token = await makeToken(TEST_USER_ID);
    const res = await post('Test text', token);
    expect(res.status).toBe(503);
  });

  it('calls ElevenLabs with correct headers and body', async () => {
    process.env.ELEVENLABS_API_KEY = 'my-api-key';
    const bytes = new Uint8Array([1, 2, 3]);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => bytes.buffer,
    });

    const token = await makeToken(TEST_USER_ID);
    await post('Aim at the left edge', token);

    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toContain('api.elevenlabs.io');
    expect(opts.method).toBe('POST');
    expect(opts.headers['xi-api-key']).toBe('my-api-key');
    expect(opts.headers['Accept']).toBe('audio/mpeg');
    const reqBody = JSON.parse(opts.body as string) as { text: string; model_id: string };
    expect(reqBody.text).toBe('Aim at the left edge');
    expect(reqBody.model_id).toBe('eleven_turbo_v2_5');
  });
});
