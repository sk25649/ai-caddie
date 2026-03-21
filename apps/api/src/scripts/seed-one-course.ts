import { seedCourse, slugify } from './seed-utils';

function parseArgs(): { name: string; city: string; state: string; zip: string; lat?: number; lng?: number } {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const name = get('--name');
  const city = get('--city');
  const state = get('--state');
  const zip = get('--zip');
  const lat = get('--lat') ? parseFloat(get('--lat')!) : undefined;
  const lng = get('--lng') ? parseFloat(get('--lng')!) : undefined;

  if (!name || !city || !state || !zip) {
    console.error('Usage: npm run db:add-course -- --name "Course Name" --city "City" --state CA --zip 12345 [--lat 0.0] [--lng 0.0]');
    process.exit(1);
  }

  return { name, city, state, zip, lat, lng };
}

async function main() {
  const { name, city, state, zip, lat, lng } = parseArgs();
  const slug = slugify(name);
  await seedCourse({ name, slug, city, state, zip, lat, lng });
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
