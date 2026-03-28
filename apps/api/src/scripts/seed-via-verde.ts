import Anthropic from '@anthropic-ai/sdk';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { courses, holes } from '../db/schema';
import type { TeeInfo } from '../db/schema';

const anthropic = new Anthropic();

const SLUG = 'via-verde-country-club';

const COURSE_META = {
  name: 'Via Verde Country Club',
  slug: SLUG,
  city: 'San Dimas',
  state: 'CA',
  zip: '91773',
  latitude: '34.1052',
  longitude: '-117.8067',
  par: 72,
};

// Tee definitions from the Local Tour scorecard (Spring 2024)
const TEES: TeeInfo[] = [
  { name: 'Tee 7', color: '#7b2d8b', totalYardage: 6443, rating: 0, slope: 0 },
  { name: 'Tee 6', color: '#cc0000', totalYardage: 6022, rating: 0, slope: 0 },
  { name: 'Tee 5', color: '#ffffff', totalYardage: 5427, rating: 0, slope: 0 },
  { name: 'Tee 4', color: '#ff8c00', totalYardage: 4848, rating: 0, slope: 0 },
  { name: 'Tee 3', color: '#cc6600', totalYardage: 4277, rating: 0, slope: 0 },
  { name: 'Tee 2', color: '#ffcc00', totalYardage: 3621, rating: 0, slope: 0 },
  { name: 'Tee 1', color: '#0066cc', totalYardage: 1500, rating: 0, slope: 0 },
  { name: 'Tee RS', color: '#228b22', totalYardage: 1200, rating: 0, slope: 0 },
];

// Par for each hole
const PARS = [4, 5, 3, 4, 4, 5, 4, 4, 3, 5, 3, 4, 3, 4, 4, 4, 4, 5];

// Yardages per tee per hole (null = tee doesn't play that hole)
const YARDAGES: Record<string, (number | null)[]> = {
  'Tee 7': [355, 517, 197, 412, 368, 551, 359, 379, 170, 495, 173, 321, 187, 354, 349, 384, 376, 496],
  'Tee 6': [355, 476, 155, 349, 345, 468, 326, 361, 162, 482, 161, 318, 169, 346, 337, 366, 362, 484],
  'Tee 5': [345, 476, 155, 349, 345, 409, 265, 275, 125, 466, 156, 316, 163, 255, 280, 360, 309, 378],
  'Tee 4': [330, 400, 155, 235, 255, 385, 265, 250, 125, 381, 156, 316, 163, 255, 280, 210, 309, 378],
  'Tee 3': [275, 350, 100, 235, 255, 330, 220, 230, 125, 300, 156, 316, 120, 220, 280, 210, 230, 325],
  'Tee 2': [250, 305, 80, 170, 190, 310, 195, 200, 100, 250, 75, 316, 120, 185, 175, 210, 185, 305],
  'Tee 1': [230, 290, 70, 140, 160, 245, 175, 130, 60, null, null, null, null, null, null, null, null, null],
  'Tee RS': [180, 215, 60, 130, 150, 195, 105, 115, 50, null, null, null, null, null, null, null, null, null],
};

const INTEL_PROMPT = `You are a golf course database system.
I have EXACT yardages for Via Verde Country Club in San Dimas, CA (par 72).
Generate ONLY the intel/strategy data — I already have the yardages.

Return ONLY valid JSON (no markdown, no backticks):

{
  "courseIntel": {
    "overview": "2-3 sentences about Via Verde CC",
    "windPatterns": "typical wind conditions",
    "greenSpeed": "stimp and grass type",
    "keyFeatures": "signature features",
    "difficultyNotes": "which stretches are hardest"
  },
  "holes": [
    {
      "holeNumber": 1,
      "handicapIndex": 11,
      "holeIntel": {
        "name": "nickname or empty string",
        "shape": "straight | dogleg left | dogleg right | double dogleg",
        "greenDepthYards": 26,
        "greenFeatures": "description of green",
        "hazards": [
          { "type": "water|bunker|barranca|OB|cliff", "location": "description", "severity": "high|medium|low" }
        ],
        "fairwayWidth": "very wide | wide | medium | narrow | very narrow",
        "elevationChange": "uphill | downhill | flat | rolling",
        "prevailingWindEffect": "usually behind | usually into | crosswind L-R | crosswind R-L | varies",
        "keyNotes": "most important strategic note"
      }
    }
    ...for all 18 holes
  ]
}

Here are the pars and longest-tee yardages for reference:
${PARS.map((p, i) => `Hole ${i + 1}: Par ${p}, ${YARDAGES['Tee 7']![i]} yards`).join('\n')}`;

async function main() {
  const existing = await db.select().from(courses).where(eq(courses.slug, SLUG));
  if (existing.length > 0) {
    console.log(`→ skipped: ${SLUG} (already exists)`);
    process.exit(0);
  }

  console.log('Generating course intel via Claude...');
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 10000,
    messages: [{ role: 'user', content: 'Generate the intel data for Via Verde Country Club.' }],
    system: INTEL_PROMPT,
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text : '{}';
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const intel = JSON.parse(text);

  // Insert course
  const [course] = await db
    .insert(courses)
    .values({
      name: COURSE_META.name,
      slug: COURSE_META.slug,
      city: COURSE_META.city,
      state: COURSE_META.state,
      zip: COURSE_META.zip,
      latitude: COURSE_META.latitude,
      longitude: COURSE_META.longitude,
      par: COURSE_META.par,
      tees: TEES,
      courseIntel: intel.courseIntel,
    })
    .returning();

  console.log(`✓ Inserted course: ${course.name} (${course.id})`);

  // Insert holes with real yardages + AI-generated intel
  for (let i = 0; i < 18; i++) {
    const holeNumber = i + 1;
    const holeIntelData = intel.holes?.find((h: { holeNumber: number }) => h.holeNumber === holeNumber);

    // Build yardages object for this hole (only include tees that play it)
    const holeYardages: Record<string, number> = {};
    for (const [teeName, yards] of Object.entries(YARDAGES)) {
      const y = yards[i];
      if (y !== null) {
        holeYardages[teeName] = y;
      }
    }

    await db.insert(holes).values({
      courseId: course.id,
      holeNumber,
      par: PARS[i],
      handicapIndex: holeIntelData?.handicapIndex ?? null,
      yardages: holeYardages,
      holeIntel: holeIntelData?.holeIntel ?? {
        name: '',
        shape: 'straight',
        greenDepthYards: 25,
        greenFeatures: '',
        hazards: [],
        fairwayWidth: 'medium',
        elevationChange: 'flat',
        prevailingWindEffect: 'varies',
        keyNotes: '',
      },
    });
  }

  console.log(`✓ Inserted 18 holes with real yardages`);
  console.log('Done!');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
