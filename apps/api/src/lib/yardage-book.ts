import type { HoleStrategy } from '../db/schema';

interface Playbook {
  id: string;
  teeName: string;
  roundDate: string | null;
  teeTime: string | null;
  preRoundTalk: string | null;
  holeStrategies: HoleStrategy[];
  projectedScore: number | null;
  driverHoles: number[] | null;
  parChanceHoles: number[] | null;
  weatherConditions: Record<string, unknown> | null;
}

interface PlayerProfile {
  displayName: string | null;
  handicap: string | null;
  dreamScore: number | null;
  goalScore: number | null;
  floorScore: number | null;
  missPrimary: string | null;
}

interface PlayerClub {
  clubName: string;
  carryDistance: number | null;
  isFairwayFinder: boolean | null;
  sortOrder: number | null;
}

interface CourseInfo {
  name: string;
  par: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function firstSentence(s: string): string {
  const idx = s.indexOf('. ');
  return idx !== -1 ? s.slice(0, idx + 1) : s;
}

function degreesToCompass(deg: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(((deg % 360) + 360) % 360 / 22.5) % 16;
  return directions[index];
}

interface WeatherExtracted {
  temp: string;
  windSpeed: string;
  compass: string;
  conditions: string;
}

function extractWeather(weatherConditions: Record<string, unknown> | null): WeatherExtracted {
  if (!weatherConditions) {
    return { temp: '—', windSpeed: '—', compass: '—', conditions: 'clear' };
  }
  const temp = typeof weatherConditions.temp === 'number'
    ? String(Math.round(weatherConditions.temp))
    : '—';
  const windSpeed = typeof weatherConditions.wind_speed === 'number'
    ? String(Math.round(weatherConditions.wind_speed))
    : '—';
  const compass = typeof weatherConditions.wind_deg === 'number'
    ? degreesToCompass(weatherConditions.wind_deg)
    : '—';
  const weather = weatherConditions.weather;
  let conditions = 'clear';
  if (Array.isArray(weather) && weather.length > 0) {
    const first = weather[0];
    if (first && typeof first === 'object' && 'description' in first && typeof first.description === 'string') {
      conditions = first.description;
    }
  }
  return { temp, windSpeed, compass, conditions };
}

// ── CSS ──────────────────────────────────────────────────────────────────────

function getStyles(): string {
  return `
    @page { size: 5.5in 4.25in landscape; margin: 0.25in; }
    @media print { .page-break { page-break-after: always; } }
    body { font-family: Georgia, serif; background: #1a2e1a; color: #f5f0e8; margin: 0; padding: 0; font-size: 11px; }
    .page { padding: 0.2in; min-height: 3.75in; box-sizing: border-box; }
    .gold { color: #d4a843; }
    .dim { color: #b8a888; }
    .danger-text { color: #ef4444; }
    .divider { border: none; border-top: 1px solid #2a4a2a; margin: 6px 0; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .terrain-box { background: #2a2000; border: 1px solid #d4a843; border-radius: 4px; padding: 4px 8px; margin: 4px 0; font-size: 10px; }
    .score-row { display: flex; gap: 16px; font-size: 10px; color: #b8a888; margin-top: 6px; }
    .page-break { page-break-after: always; }
  `;
}

// ── Cover page ───────────────────────────────────────────────────────────────

function buildCoverPage(
  playbook: Playbook,
  profile: PlayerProfile,
  clubs: PlayerClub[],
  course: CourseInfo
): string {
  const { temp, windSpeed, compass, conditions } = extractWeather(playbook.weatherConditions);
  const hasWeather = playbook.weatherConditions !== null &&
    (typeof playbook.weatherConditions.temp === 'number' || typeof playbook.weatherConditions.wind_speed === 'number');

  // Pre-round bullets: split by ". " or "\n", max 6
  const preRoundTalk = playbook.preRoundTalk || '';
  const rawSentences = preRoundTalk
    .split(/\n|(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 6);
  const bulletItems = rawSentences.map((s) => `<li>${escapeHtml(s)}</li>`).join('');

  // Top 6 clubs sorted by sortOrder (then carryDistance desc as fallback)
  const sortedClubs = [...clubs].sort((a, b) => {
    const oa = a.sortOrder ?? 999;
    const ob = b.sortOrder ?? 999;
    if (oa !== ob) return oa - ob;
    return (b.carryDistance ?? 0) - (a.carryDistance ?? 0);
  }).slice(0, 6);

  const clubItems = sortedClubs.map((c) => {
    const star = c.isFairwayFinder ? ' ★' : '';
    const dist = c.carryDistance != null ? ` ${c.carryDistance}y` : '';
    return `<div>${escapeHtml(c.clubName)}${escapeHtml(dist)}${star}</div>`;
  }).join('');

  const weatherSection = hasWeather ? `
  <div class="gold" style="font-size:9px;letter-spacing:2px;text-transform:uppercase;">Weather Today</div>
  <div>${escapeHtml(temp)}°F · ${escapeHtml(windSpeed)}mph ${escapeHtml(compass)} · ${escapeHtml(conditions)}</div>
  <hr class="divider">` : '';

  return `<div class="page page-break">
  <div style="font-size:9px;letter-spacing:3px;text-transform:uppercase;" class="gold">AI Caddie · Yardage Book</div>
  <hr class="divider">
  <div style="font-size:22px;font-weight:bold;margin:4px 0;">${escapeHtml(profile.displayName || 'Golfer')}</div>
  <div style="font-size:13px;" class="dim">HCP ${escapeHtml(profile.handicap || '—')}</div>
  <hr class="divider">
  <div style="font-size:15px;font-weight:bold;">${escapeHtml(course.name)}</div>
  <div class="dim">${escapeHtml(playbook.teeName)} Tees · ${escapeHtml(playbook.roundDate || '')} · Tee ${escapeHtml(playbook.teeTime || '')}</div>
  <hr class="divider">
  ${weatherSection}
  <div class="gold" style="font-size:9px;letter-spacing:2px;text-transform:uppercase;">Your Targets</div>
  <div>Dream ${escapeHtml(String(profile.dreamScore ?? '—'))} · Goal ${escapeHtml(String(profile.goalScore ?? '—'))} · Floor ${escapeHtml(String(profile.floorScore ?? '—'))}</div>
  <hr class="divider">
  <div class="gold" style="font-size:9px;letter-spacing:2px;text-transform:uppercase;">Pre-Round Keys</div>
  <ul style="margin:4px 0;padding-left:16px;">${bulletItems}</ul>
  <hr class="divider">
  <div class="gold" style="font-size:9px;letter-spacing:2px;text-transform:uppercase;">Your Bag</div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:2px 12px;">
    ${clubItems}
  </div>
</div>`;
}

// ── Hole page ────────────────────────────────────────────────────────────────

function buildHolePage(hole: HoleStrategy, isLast: boolean): string {
  const handicapIndex = (hole as unknown as Record<string, unknown>).handicap_index;
  const hdcpDisplay = handicapIndex != null ? String(handicapIndex) : '—';
  const parChanceLabel = hole.is_par_chance
    ? '<span style="font-size:11px;font-weight:bold;">&#9733; PAR CHANCE</span>'
    : '<span style="font-size:11px;font-weight:bold;">BOGEY TARGET</span>';

  // Approach section
  const approachSection = hole.approach_club ? `
  <div style="margin:6px 0;">
    <span class="gold" style="font-size:9px;letter-spacing:2px;text-transform:uppercase;">Approach</span>
    <span style="margin-left:8px;font-weight:bold;">~${escapeHtml(String(hole.approach_distance ?? '?'))} yds · ${escapeHtml(hole.approach_club)}</span>
  </div>` : '';

  // DO THIS column
  let doThisItems: string;
  if (hole.do_this && hole.do_this.length > 0) {
    doThisItems = hole.do_this.map((item) => `<div>• ${escapeHtml(item)}</div>`).join('');
  } else if (hole.play_bullets && hole.play_bullets.length > 0) {
    doThisItems = hole.play_bullets.map((item) => `<div>• ${escapeHtml(item)}</div>`).join('');
  } else {
    doThisItems = `<div>• ${escapeHtml(hole.tee_club)} to landing zone</div>`;
  }

  // NOT THIS column
  let dontDoItems: string;
  if (hole.dont_do && hole.dont_do.length > 0) {
    dontDoItems = hole.dont_do.map((item) => `<div>• ${escapeHtml(item)}</div>`).join('');
  } else {
    dontDoItems = `<div>• ${escapeHtml(firstSentence(hole.danger))}</div>`;
  }

  // Terrain note
  const terrainSection = hole.terrain_note && hole.terrain_note.trim().length > 0
    ? `<div class="terrain-box">&#9888; TERRAIN: ${escapeHtml(hole.terrain_note)}</div>`
    : '';

  const pageClass = isLast ? 'page' : 'page page-break';

  return `<div class="${pageClass}">
  <div style="display:flex;justify-content:space-between;align-items:baseline;">
    <div>
      <span style="font-size:28px;font-weight:bold;" class="gold">HOLE ${hole.hole_number}</span>
      <span style="font-size:13px;margin-left:8px;">PAR ${hole.par} · HDCP ${escapeHtml(hdcpDisplay)} · ${hole.yardage} YDS</span>
    </div>
    <div>${parChanceLabel}</div>
  </div>
  <hr class="divider">

  <div style="margin-bottom:6px;">
    <span class="gold" style="font-size:9px;letter-spacing:2px;text-transform:uppercase;">Tee</span>
    <span style="margin-left:8px;font-weight:bold;">${escapeHtml(hole.tee_club)}</span>
    <span class="dim" style="margin-left:4px;">(${escapeHtml(String(hole.carry_target ?? '?'))} carry)</span>
  </div>
  <div class="dim" style="font-size:10px;">Aim: <span style="color:#f5f0e8;">${escapeHtml(hole.aim_point || '—')}</span></div>
  ${approachSection}

  <hr class="divider">

  <div class="two-col" style="margin:4px 0;">
    <div>
      <div class="gold" style="font-size:9px;letter-spacing:2px;text-transform:uppercase;margin-bottom:3px;">Do This</div>
      ${doThisItems}
    </div>
    <div>
      <div class="danger-text" style="font-size:9px;letter-spacing:2px;text-transform:uppercase;margin-bottom:3px;">Not This</div>
      ${dontDoItems}
    </div>
  </div>

  ${terrainSection}

  <hr class="divider">

  <div style="font-size:10px;"><span class="danger-text" style="font-size:9px;letter-spacing:2px;text-transform:uppercase;">Danger</span> ${escapeHtml(hole.danger)}</div>

  <div style="font-size:10px;margin-top:4px;" class="dim">
    L: ${escapeHtml(firstSentence(hole.miss_left))} · R: ${escapeHtml(firstSentence(hole.miss_right))} · Short: ${escapeHtml(firstSentence(hole.miss_short))}
  </div>

  <hr class="divider">
  <div class="score-row">
    <span>Birdie (${hole.par - 1})</span>
    <span>Par (${hole.par})</span>
    <span>Bogey (${hole.par + 1})</span>
    <span>Double (${hole.par + 2})</span>
    <span style="margin-left:auto;">Score: ____</span>
  </div>
</div>`;
}

// ── Scorecard page ───────────────────────────────────────────────────────────

function buildScorecardPage(
  playbook: Playbook,
  profile: PlayerProfile,
  course: CourseInfo
): string {
  const holes = playbook.holeStrategies;

  const buildRows = (start: number, end: number): string => {
    return holes.slice(start, end).map((h) => {
      const target = h.is_par_chance ? 'B&#9733;' : 'B';
      return `<tr style="border-bottom:1px solid #2a4a2a;">
        <td style="text-align:left;padding:2px 4px;">${h.hole_number}</td>
        <td style="text-align:center;padding:2px 4px;">${h.par}</td>
        <td style="text-align:center;padding:2px 4px;">${(h as unknown as Record<string, unknown>).handicap_index ?? '—'}</td>
        <td style="text-align:center;padding:2px 4px;" class="gold">${target}</td>
        <td style="text-align:center;padding:2px 4px;"></td>
      </tr>`;
    }).join('');
  };

  const frontNine = holes.slice(0, 9);
  const backNine = holes.slice(9, 18);
  const frontPar = frontNine.reduce((sum, h) => sum + h.par, 0);
  const backPar = backNine.reduce((sum, h) => sum + h.par, 0);
  const totalPar = course.par;

  const driverHoles = Array.isArray(playbook.driverHoles) ? playbook.driverHoles : [];
  const parChanceHoles = Array.isArray(playbook.parChanceHoles) ? playbook.parChanceHoles : [];

  return `<div class="page">
  <div class="gold" style="font-size:9px;letter-spacing:2px;text-transform:uppercase;">Scorecard</div>
  <table style="width:100%;border-collapse:collapse;font-size:10px;margin-top:6px;">
    <thead>
      <tr style="color:#d4a843;border-bottom:1px solid #2a4a2a;">
        <th style="text-align:left;padding:2px 4px;">HOLE</th>
        <th style="text-align:center;padding:2px 4px;">PAR</th>
        <th style="text-align:center;padding:2px 4px;">HDCP</th>
        <th style="text-align:center;padding:2px 4px;">TARGET</th>
        <th style="text-align:center;padding:2px 4px;">SCORE</th>
      </tr>
    </thead>
    <tbody>
      ${buildRows(0, 9)}
      <tr style="color:#d4a843;border-top:1px solid #2a4a2a;border-bottom:1px solid #2a4a2a;">
        <td style="text-align:left;padding:2px 4px;font-weight:bold;">OUT</td>
        <td style="text-align:center;padding:2px 4px;font-weight:bold;">${frontPar}</td>
        <td style="text-align:center;padding:2px 4px;"></td>
        <td style="text-align:center;padding:2px 4px;"></td>
        <td style="text-align:center;padding:2px 4px;"></td>
      </tr>
      ${buildRows(9, 18)}
      <tr style="color:#d4a843;border-top:1px solid #2a4a2a;border-bottom:1px solid #2a4a2a;">
        <td style="text-align:left;padding:2px 4px;font-weight:bold;">IN</td>
        <td style="text-align:center;padding:2px 4px;font-weight:bold;">${backPar}</td>
        <td style="text-align:center;padding:2px 4px;"></td>
        <td style="text-align:center;padding:2px 4px;"></td>
        <td style="text-align:center;padding:2px 4px;"></td>
      </tr>
      <tr style="color:#d4a843;border-top:2px solid #d4a843;">
        <td style="text-align:left;padding:2px 4px;font-weight:bold;">TOTAL</td>
        <td style="text-align:center;padding:2px 4px;font-weight:bold;">${totalPar}</td>
        <td style="text-align:center;padding:2px 4px;"></td>
        <td style="text-align:center;padding:2px 4px;"></td>
        <td style="text-align:center;padding:2px 4px;"></td>
      </tr>
    </tbody>
  </table>
  <hr class="divider">
  <div style="font-size:10px;" class="dim">
    Driver holes: ${driverHoles.length > 0 ? escapeHtml(driverHoles.join(', ')) : '—'} · Par chances: ${parChanceHoles.length}
  </div>
  <div style="font-size:10px;margin-top:4px;">
    Dream: <span class="gold">${escapeHtml(String(profile.dreamScore ?? '—'))}</span> · Goal: <span class="gold">${escapeHtml(String(profile.goalScore ?? '—'))}</span> · Floor: <span class="gold">${escapeHtml(String(profile.floorScore ?? '—'))}</span>
  </div>
</div>`;
}

// ── Main export ──────────────────────────────────────────────────────────────

export function generateYardageBookHtml(
  playbook: Playbook,
  profile: PlayerProfile,
  clubs: PlayerClub[],
  course: CourseInfo
): string {
  const playerName = profile.displayName || 'Golfer';
  const title = `${escapeHtml(playerName)} — ${escapeHtml(course.name)} Yardage Book`;

  const coverPage = buildCoverPage(playbook, profile, clubs, course);

  const holePages = playbook.holeStrategies.map((hole, i) =>
    buildHolePage(hole, false)
  ).join('\n');

  const scorecardPage = buildScorecardPage(playbook, profile, course);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>${getStyles()}</style>
</head>
<body>
${coverPage}
${holePages}
${scorecardPage}
</body>
</html>`;
}

// Export helpers for testing
export { firstSentence, escapeHtml, degreesToCompass, extractWeather };
