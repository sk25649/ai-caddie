import { seedCourse } from './seed-utils';

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
