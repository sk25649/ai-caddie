import type { HoleStrategy } from './api';

/**
 * Builds the spoken script for a hole — reads all key strategy fields
 * in a natural order: intro → club → aim → carry → bullets → terrain → danger.
 */
export function buildVoiceScript(hole: HoleStrategy): string {
  const parts: string[] = [
    `Hole ${hole.hole_number}. Par ${hole.par}. ${hole.yardage} yards.`,
    `Club: ${hole.tee_club}.`,
  ];

  if (hole.aim_point) {
    parts.push(`Aim at ${hole.aim_point}.`);
  }
  if (hole.carry_target) {
    parts.push(`Carry ${hole.carry_target} yards to the landing zone.`);
  }

  if (hole.play_bullets && hole.play_bullets.length > 0) {
    hole.play_bullets.forEach((b) => parts.push(b));
  } else if (hole.strategy) {
    parts.push(hole.strategy);
  }

  if (hole.terrain_note && hole.terrain_note.trim().length > 0) {
    parts.push(`Terrain warning: ${hole.terrain_note}`);
  }

  parts.push(`Danger: ${hole.danger}`);

  return parts.join(' ');
}
