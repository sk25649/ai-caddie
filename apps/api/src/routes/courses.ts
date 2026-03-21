import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db';
import { courses, holes } from '../db/schema';
import { eq, ilike, and } from 'drizzle-orm';
import { authMiddleware } from './auth';
import type { AppEnv } from '../lib/types';

export const courseRoutes = new Hono<AppEnv>();
courseRoutes.use('*', authMiddleware);

const searchSchema = z.object({
  q: z.string().optional(),
});

// GET /courses?q=torrey
courseRoutes.get('/', async (c) => {
  const query = c.req.query('q');

  let courseList;
  if (query) {
    courseList = await db
      .select({
        id: courses.id,
        name: courses.name,
        slug: courses.slug,
        city: courses.city,
        state: courses.state,
        par: courses.par,
        tees: courses.tees,
      })
      .from(courses)
      .where(and(eq(courses.isActive, true), ilike(courses.name, `%${query}%`)));
  } else {
    courseList = await db
      .select({
        id: courses.id,
        name: courses.name,
        slug: courses.slug,
        city: courses.city,
        state: courses.state,
        par: courses.par,
        tees: courses.tees,
      })
      .from(courses)
      .where(eq(courses.isActive, true));
  }

  return c.json({ data: courseList });
});

// GET /courses/:slug
courseRoutes.get('/:slug', async (c) => {
  const slug = c.req.param('slug');

  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.slug, slug));

  if (!course) {
    return c.json({ error: 'Course not found' }, 404);
  }

  return c.json({ data: course });
});

// GET /courses/:slug/holes
courseRoutes.get('/:slug/holes', async (c) => {
  const slug = c.req.param('slug');

  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.slug, slug));

  if (!course) {
    return c.json({ error: 'Course not found' }, 404);
  }

  const courseHoles = await db
    .select()
    .from(holes)
    .where(eq(holes.courseId, course.id))
    .orderBy(holes.holeNumber);

  return c.json({ data: { course, holes: courseHoles } });
});
