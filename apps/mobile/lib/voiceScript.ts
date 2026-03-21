import type { HoleStrategy } from './api';

/**
 * Builds a tight caddie script — 25-35 words, 5-10 seconds at 1.2x speed.
 * Club, aim, key danger, mindset. Nothing else.
 */
export function buildVoiceScript(hole: HoleStrategy): string {
  const parts: string[] = [];

  // Club + aim in one breath
  if (hole.aim_point) {
    parts.push(`${hole.tee_club}, aim ${hole.aim_point}.`);
  } else {
    parts.push(`${hole.tee_club} here.`);
  }

  // One key play bullet — just the first one
  if (hole.play_bullets && hole.play_bullets.length > 0) {
    parts.push(hole.play_bullets[0]);
  }

  // Danger — the one thing to avoid
  if (hole.danger) {
    parts.push(`Avoid ${hole.danger.toLowerCase()}.`);
  }

  // Closing — short
  if (hole.is_par_chance) {
    parts.push("Let's go get this one.");
  } else {
    parts.push("Play smart, let's go.");
  }

  return parts.join(' ');
}
