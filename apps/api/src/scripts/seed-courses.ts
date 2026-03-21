import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db';
import { courses, holes } from '../db/schema';

const anthropic = new Anthropic();

const LA_COURSES = [
  { name: 'Trump National Golf Club Los Angeles', slug: 'trump-national-la', city: 'Rancho Palos Verdes', state: 'CA', zip: '90275', lat: 33.7411, lng: -118.3392 },
  { name: 'Torrey Pines South Course', slug: 'torrey-pines-south', city: 'La Jolla', state: 'CA', zip: '92037', lat: 32.9005, lng: -117.2524 },
  { name: 'Torrey Pines North Course', slug: 'torrey-pines-north', city: 'La Jolla', state: 'CA', zip: '92037', lat: 32.9005, lng: -117.2524 },
  { name: 'Los Verdes Golf Course', slug: 'los-verdes', city: 'Rancho Palos Verdes', state: 'CA', zip: '90275', lat: 33.7563, lng: -118.3878 },
  { name: 'Rancho Park Golf Course', slug: 'rancho-park', city: 'Los Angeles', state: 'CA', zip: '90064', lat: 34.0385, lng: -118.4229 },
  { name: 'Wilson Golf Course', slug: 'wilson-griffith', city: 'Los Angeles', state: 'CA', zip: '90027', lat: 34.1384, lng: -118.2892 },
  { name: 'Harding Golf Course', slug: 'harding-griffith', city: 'Los Angeles', state: 'CA', zip: '90027', lat: 34.1378, lng: -118.2847 },
  { name: 'Rustic Canyon Golf Course', slug: 'rustic-canyon', city: 'Moorpark', state: 'CA', zip: '93021', lat: 34.2739, lng: -118.8681 },
  { name: 'Industry Hills Eisenhower Course', slug: 'industry-hills-ike', city: 'City of Industry', state: 'CA', zip: '91744', lat: 34.0011, lng: -117.9267 },
  { name: 'Industry Hills Zaharias Course', slug: 'industry-hills-zaharias', city: 'City of Industry', state: 'CA', zip: '91744', lat: 34.0011, lng: -117.9267 },
  { name: 'Pelican Hill South Course', slug: 'pelican-hill-south', city: 'Newport Coast', state: 'CA', zip: '92657', lat: 33.5879, lng: -117.8380 },
  { name: 'Pelican Hill North Course', slug: 'pelican-hill-north', city: 'Newport Coast', state: 'CA', zip: '92657', lat: 33.5879, lng: -117.8380 },
  { name: 'Monarch Beach Golf Links', slug: 'monarch-beach', city: 'Dana Point', state: 'CA', zip: '92629', lat: 33.4700, lng: -117.7145 },
  { name: 'Brookside Golf Club No. 1', slug: 'brookside-1', city: 'Pasadena', state: 'CA', zip: '91103', lat: 34.1573, lng: -118.1672 },
  { name: 'Scholl Canyon Golf Course', slug: 'scholl-canyon', city: 'Glendale', state: 'CA', zip: '91206', lat: 34.1647, lng: -118.2167 },
  { name: 'Alondra Park Golf Course', slug: 'alondra-park', city: 'Lawndale', state: 'CA', zip: '90260', lat: 33.8862, lng: -118.3529 },
  { name: 'El Dorado Park Golf Course', slug: 'el-dorado-park', city: 'Long Beach', state: 'CA', zip: '90815', lat: 33.8168, lng: -118.0953 },
  { name: 'Recreation Park 18', slug: 'rec-park-18', city: 'Long Beach', state: 'CA', zip: '90804', lat: 33.7915, lng: -118.1611 },
  { name: 'Skylinks Golf Course', slug: 'skylinks', city: 'Long Beach', state: 'CA', zip: '90808', lat: 33.8204, lng: -118.1477 },
  { name: 'Chester Washington Golf Course', slug: 'chester-washington', city: 'Hawthorne', state: 'CA', zip: '90250', lat: 33.9290, lng: -118.3400 },
  { name: 'Classic Club', slug: 'classic-club', city: 'Palm Desert', state: 'CA', zip: '92211', lat: 33.7379, lng: -116.3508 },
];

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

interface SeedCourseData {
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

async function seedCourse(courseInfo: (typeof LA_COURSES)[0]): Promise<void> {
  console.log(`Seeding: ${courseInfo.name}...`);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    messages: [
      {
        role: 'user',
        content: `Provide complete data for: ${courseInfo.name} in ${courseInfo.city}, ${courseInfo.state} ${courseInfo.zip}`,
      },
    ],
    system: COURSE_INTEL_PROMPT,
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text : '{}';
  // Strip markdown code fences if Claude wraps the response
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const data: SeedCourseData = JSON.parse(text);

  const [course] = await db
    .insert(courses)
    .values({
      name: courseInfo.name,
      slug: courseInfo.slug,
      city: courseInfo.city,
      state: courseInfo.state,
      zip: courseInfo.zip,
      latitude: courseInfo.lat.toString(),
      longitude: courseInfo.lng.toString(),
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

  console.log(`  \u2713 ${courseInfo.name} \u2014 ${data.holes.length} holes`);
}

async function main(): Promise<void> {
  for (const course of LA_COURSES) {
    try {
      await seedCourse(course);
    } catch (err) {
      console.error(`  \u2717 Failed to seed ${course.name}:`, err);
    }
    // Rate limit: wait 2s between courses
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.log('\nDone! All courses seeded.');
  process.exit(0);
}

main();
