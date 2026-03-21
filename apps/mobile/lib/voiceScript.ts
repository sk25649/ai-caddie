import type { HoleStrategy } from './api';

/**
 * Builds a conversational caddie script for a hole — sounds like a real
 * caddie talking to their player on the tee box, not a robot reading stats.
 */
export function buildVoiceScript(hole: HoleStrategy): string {
  const parts: string[] = [];

  // Opener — casual, brief
  const parLabel = hole.par === 3 ? 'par 3' : hole.par === 5 ? 'par 5' : 'par 4';
  parts.push(`Alright, hole ${hole.hole_number}. ${hole.yardage} yard ${parLabel}.`);

  // Club recommendation with context
  if (hole.play_bullets && hole.play_bullets.length > 0) {
    // Weave bullets into natural caddie talk
    parts.push(`I like ${hole.tee_club} here.`);
    hole.play_bullets.forEach((b) => parts.push(b));
  } else {
    parts.push(`Grab the ${hole.tee_club}.`);
    if (hole.strategy) parts.push(hole.strategy);
  }

  // Aim point — directional advice
  if (hole.aim_point) {
    parts.push(`Aim at ${hole.aim_point}.`);
  }

  // Carry info if relevant
  if (hole.carry_target) {
    parts.push(`You need ${hole.carry_target} to clear.`);
  }

  // Terrain heads-up
  if (hole.terrain_note && hole.terrain_note.trim().length > 0) {
    parts.push(`Watch out, ${hole.terrain_note}.`);
  }

  // Danger — the one thing to avoid
  if (hole.danger) {
    parts.push(`Big miss is ${hole.danger}.`);
  }

  // Closing — target mindset
  if (hole.is_par_chance) {
    parts.push("This is a birdie or par hole. Let's go get it.");
  } else {
    parts.push("Bogey is a great score here. Play smart, let's go.");
  }

  return parts.join(' ');
}
