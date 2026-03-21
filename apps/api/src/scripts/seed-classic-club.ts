import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db';
import { courses, holes } from '../db/schema';

const anthropic = new Anthropic();

const COURSE_INTEL_PROMPT = `You are a golf course database system.
Provide COMPLETE and ACCURATE data for this golf course.
Return ONLY valid JSON (no markdown, no backticks).

{
  "par": number,
  "tees": [
    { "name": "Black", "color": "#000", "totalYardage": number, "rating": number, "slope": number },
    ...for each tee available
  ],
  "courseIntel": {
    "overview": "2-3 sentences about the course",
    "windPatterns": "typical wind conditions",
    "greenSpeed": "stimp and grass type",
    "keyFeatures": "signature features",
    "difficultyNotes": "which stretches are hardest"
  },
  "holes": [
    {
      "holeNumber": 1,
      "par": 4,
      "handicapIndex": 11,
      "yardages": { "Black": 340, "Blue": 314, "White": 309, "Red": 284 },
      "holeIntel": {
        "name": "nickname or empty string",
        "shape": "straight | dogleg left | dogleg right | double dogleg",
        "greenDepthYards": 26,
        "greenFeatures": "description of green (slope, tiers, speed)",
        "hazards": [
          { "type": "water|bunker|barranca|OB|cliff", "location": "description", "severity": "high|medium|low" }
        ],
        "fairwayWidth": "very wide | wide | medium | narrow | very narrow",
        "elevationChange": "uphill | downhill | flat | rolling",
        "prevailingWindEffect": "usually behind | usually into | crosswind L-R | crosswind R-L | varies",
        "keyNotes": "most important strategic note for this hole"
      }
    }
    ...for all 18 holes
  ]
}`;

async function main(): Promise<void> {
  console.log('Seeding: Classic Club (Palm Desert)...');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    system: COURSE_INTEL_PROMPT,
    messages: [
      {
        role: 'user',
        content: 'Provide complete data for: Classic Club in Palm Desert, CA 92211',
      },
    ],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text : '{}';
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const data = JSON.parse(text);

  const [course] = await db
    .insert(courses)
    .values({
      name: 'Classic Club',
      slug: 'classic-club',
      city: 'Palm Desert',
      state: 'CA',
      zip: '92211',
      latitude: '33.7379',
      longitude: '-116.3508',
      par: data.par,
      tees: data.tees,
      courseIntel: data.courseIntel,
    })
    .returning();

  for (const hole of data.holes) {
    await db.insert(holes).values({
      courseId: course.id,
      holeNumber: hole.holeNumber,
      par: hole.par,
      handicapIndex: hole.handicapIndex,
      yardages: hole.yardages,
      holeIntel: hole.holeIntel,
    });
  }

  console.log(`✓ Classic Club — ${data.holes.length} holes seeded`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
