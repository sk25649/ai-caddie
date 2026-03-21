import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from './auth';
import type { AppEnv } from '../lib/types';

export const voiceRoutes = new Hono<AppEnv>();
voiceRoutes.use('*', authMiddleware);

const speakSchema = z.object({
  text: z.string().min(1).max(2000),
});

const DEFAULT_VOICE_ID = 'pNInz6obpgDQGcFmaJgB'; // Adam — clear American English

voiceRoutes.post('/speak', async (c) => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return c.json({ error: 'Voice unavailable' }, 503);
  }

  const body = await c.req.json();
  const parsed = speakSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const { text } = parsed.data;
  const voiceId = process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID;

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown error');
      console.error(`[voice] ElevenLabs error ${res.status}:`, errText);
      return c.json({ error: 'Voice unavailable' }, 503);
    }

    const buffer = await res.arrayBuffer();
    const audio = Buffer.from(buffer).toString('base64');

    return c.json({ data: { audio, format: 'mp3' } });
  } catch (err) {
    console.error('[voice] ElevenLabs request failed:', err);
    return c.json({ error: 'Voice unavailable' }, 503);
  }
});
