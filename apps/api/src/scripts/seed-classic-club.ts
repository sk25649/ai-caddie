import { seedCourse } from './seed-utils';

async function main() {
  await seedCourse({
    name: 'Classic Club',
    slug: 'classic-club',
    city: 'Palm Desert',
    state: 'CA',
    zip: '92211',
    lat: 33.7379,
    lng: -116.3508,
  });
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
