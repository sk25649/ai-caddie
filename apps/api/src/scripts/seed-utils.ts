import Anthropic from '@anthropic-ai/sdk';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { courses, holes } from '../db/schema';

const anthropic = new Anthropic();

export const COURSE_INTEL_PROMPT = `You are a golf course database system.
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

export interface SeedCourseData {
  par: number;
  tees: Array<{ name: string; color: string; totalYardage: number; rating: number; slope: number }>;
  courseIntel: Record<string, string>;
  holes: Array<{
    holeNumber: number;
    par: number;
    handicapIndex: number;
    yardages: Record<string, number>;
    holeIntel: Record<string, unknown>;
  }>;
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export async function seedCourse(courseInfo: {
  name: string;
  slug: string;
  city: string;
  state: string;
  zip: string;
  lat?: number;
  lng?: number;
}): Promise<void> {
  const { name, slug, city, state, zip, lat, lng } = courseInfo;

  const existing = await db.select().from(courses).where(eq(courses.slug, slug));
  if (existing.length > 0) {
    console.log(`\u2192 skipped: ${slug} (already exists)`);
    return;
  }

  if (!lat || !lng) {
    console.warn(`\u26a0 No coordinates for ${name} \u2014 weather will use fallback`);
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    messages: [
      {
        role: 'user',
        content: `Provide complete data for: ${name} in ${city}, ${state} ${zip}`,
      },
    ],
    system: COURSE_INTEL_PROMPT,
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text : '{}';
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const data: SeedCourseData = JSON.parse(text);

  const [course] = await db
    .insert(courses)
    .values({
      name,
      slug,
      city,
      state,
      zip,
      latitude: lat ? lat.toString() : undefined,
      longitude: lng ? lng.toString() : undefined,
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

  console.log(`\u2713 Seeded: ${name}`);
}
