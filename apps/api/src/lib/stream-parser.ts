/**
 * StreamingHoleParser — extracts individual hole objects from a streaming JSON response.
 *
 * Uses a character-level state machine so it works correctly even when
 * fed one character at a time (as happens with Claude streaming deltas).
 */

export interface ParsedMeta {
  pre_round_talk: string;
  projected_score: number;
  driver_holes: number[];
  par_chance_holes: number[];
}

export class StreamingHoleParser {
  private buffer = '';
  private holesArrayFound = false;
  private inHolesArray = false;
  private braceDepth = 0;
  private holeStart = -1;
  private inString = false;
  private escapeNext = false;
  private scanPos = 0; // next character to process in the state machine
  private emittedHoles: Array<Record<string, unknown>> = [];
  private metaEmitted = false;

  /** Feed a text delta from the Claude stream */
  onDelta(text: string): {
    meta?: ParsedMeta;
    holes: Array<Record<string, unknown>>;
  } {
    this.buffer += text;
    const result: { meta?: ParsedMeta; holes: Array<Record<string, unknown>> } = { holes: [] };

    // Try to extract meta before holes array starts
    if (!this.metaEmitted) {
      const meta = this.tryExtractMeta();
      if (meta) {
        this.metaEmitted = true;
        result.meta = meta;
      }
    }

    // Find the "holes" array if not yet found
    if (!this.holesArrayFound) {
      const idx = this.buffer.indexOf('"holes"');
      if (idx !== -1) {
        const bracketIdx = this.buffer.indexOf('[', idx);
        if (bracketIdx !== -1) {
          this.holesArrayFound = true;
          this.inHolesArray = true;
          this.scanPos = bracketIdx + 1;
        }
      }
    }

    // Process new characters through the state machine
    if (this.inHolesArray) {
      const holes = this.processChars();
      result.holes = holes;
    }

    return result;
  }

  getEmittedHoles(): Array<Record<string, unknown>> {
    return this.emittedHoles;
  }

  getFullText(): string {
    return this.buffer;
  }

  private tryExtractMeta(): ParsedMeta | null {
    const holesIdx = this.buffer.indexOf('"holes"');
    const searchRegion = holesIdx !== -1 ? this.buffer.slice(0, holesIdx) : this.buffer;

    const preRoundMatch = searchRegion.match(/"pre_round_talk"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const projectedMatch = searchRegion.match(/"projected_score"\s*:\s*(\d+)/);
    const driverMatch = searchRegion.match(/"driver_holes"\s*:\s*\[([^\]]*)\]/);
    const parChanceMatch = searchRegion.match(/"par_chance_holes"\s*:\s*\[([^\]]*)\]/);

    if (preRoundMatch && projectedMatch && driverMatch && parChanceMatch) {
      return {
        pre_round_talk: preRoundMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n'),
        projected_score: parseInt(projectedMatch[1]),
        driver_holes: driverMatch[1] ? driverMatch[1].split(',').map((s) => parseInt(s.trim())).filter((n) => !isNaN(n)) : [],
        par_chance_holes: parChanceMatch[1] ? parChanceMatch[1].split(',').map((s) => parseInt(s.trim())).filter((n) => !isNaN(n)) : [],
      };
    }
    return null;
  }

  /** Process characters from scanPos to end of buffer, tracking string/brace state */
  private processChars(): Array<Record<string, unknown>> {
    const holes: Array<Record<string, unknown>> = [];

    for (let i = this.scanPos; i < this.buffer.length; i++) {
      const ch = this.buffer[i];

      // Handle escape sequences inside strings
      if (this.escapeNext) {
        this.escapeNext = false;
        continue;
      }

      if (this.inString) {
        if (ch === '\\') {
          this.escapeNext = true;
        } else if (ch === '"') {
          this.inString = false;
        }
        continue;
      }

      // Outside of strings
      if (ch === '"') {
        this.inString = true;
        continue;
      }

      if (ch === '{') {
        if (this.braceDepth === 0) {
          this.holeStart = i;
        }
        this.braceDepth++;
      } else if (ch === '}') {
        this.braceDepth--;
        if (this.braceDepth === 0 && this.holeStart !== -1) {
          const holeJson = this.buffer.slice(this.holeStart, i + 1);
          try {
            const hole = JSON.parse(holeJson) as Record<string, unknown>;
            holes.push(hole);
            this.emittedHoles.push(hole);
          } catch {
            // Malformed — skip
          }
          this.holeStart = -1;
        }
      } else if (ch === ']' && this.braceDepth === 0) {
        // End of holes array
        this.inHolesArray = false;
        break;
      }
    }

    this.scanPos = this.buffer.length;
    return holes;
  }
}
