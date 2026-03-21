import type { HoleStrategy } from './api';

/**
 * Builds a caddie script — 35-50 words, ~8-12 seconds at 1.2x speed.
 * Quick intro, club + aim, top two bullets, danger, closer.
 */
export function buildVoiceScript(hole: HoleStrategy): string {
  const parts: string[] = [];

  // Quick intro — hole and yardage only
  const parLabel = hole.par === 3 ? 'par 3' : hole.par === 5 ? 'par 5' : 'par 4';
  parts.push(`Hole ${hole.hole_number}, ${hole.yardage} yard ${parLabel}.`);

  // Club + aim
  if (hole.aim_point) {
    parts.push(`${hole.tee_club}, aim ${hole.aim_point}.`);
  } else {
    parts.push(`${hole.tee_club} here.`);
  }

  // Top two play bullets
  if (hole.play_bullets && hole.play_bullets.length > 0) {
    const bullets = hole.play_bullets.slice(0, 2);
    bullets.forEach((b) => parts.push(b));
  } else if (hole.strategy) {
    parts.push(hole.strategy);
  }

  // Danger
  if (hole.danger) {
    parts.push(`Avoid ${hole.danger.toLowerCase()}.`);
  }

  // Closer
  if (hole.is_par_chance) {
    parts.push("Let's go get this one.");
  } else {
    parts.push("Play smart, let's go.");
  }

  return parts.join(' ');
}
