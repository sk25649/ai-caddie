import { useQuery } from '@tanstack/react-query';
import { getCourses, getCourse, getCourseHoles } from '../lib/api';

export function useCourses(query?: string) {
  return useQuery({
    queryKey: ['courses', query],
    queryFn: () => getCourses(query),
  });
}

export function useCourse(slug: string) {
  return useQuery({
    queryKey: ['course', slug],
    queryFn: () => getCourse(slug),
    enabled: !!slug,
  });
}

export function useCourseHoles(slug: string) {
  return useQuery({
    queryKey: ['courseHoles', slug],
    queryFn: () => getCourseHoles(slug),
    enabled: !!slug,
  });
}
