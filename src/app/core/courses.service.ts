import { Injectable } from '@angular/core';
import { Course, CourseWithProgress, Lesson } from './models';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class CoursesService {
  constructor(private supabase: SupabaseService) {}

  async listCourses(): Promise<Course[]> {
    const { data, error } = await this.supabase.client
      .from('courses')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async listCoursesWithProgress(): Promise<CourseWithProgress[]> {
    const [coursesRes, lessonsRes] = await Promise.all([
      this.supabase.client.from('courses').select('*').order('created_at', { ascending: false }),
      this.supabase.client.from('lessons').select('course_id, completed')
    ]);
    if (coursesRes.error) throw coursesRes.error;
    if (lessonsRes.error) throw lessonsRes.error;

    const stats = new Map<string, { total: number; done: number }>();
    for (const l of (lessonsRes.data ?? []) as { course_id: string; completed: boolean }[]) {
      const s = stats.get(l.course_id) ?? { total: 0, done: 0 };
      s.total++;
      if (l.completed) s.done++;
      stats.set(l.course_id, s);
    }

    return (coursesRes.data ?? []).map(c => ({
      ...c,
      total_lessons: stats.get(c.id)?.total ?? 0,
      completed_lessons: stats.get(c.id)?.done ?? 0
    }));
  }

  async overallStats(): Promise<{ courses: number; lessons: number; completed: number }> {
    const [coursesRes, lessonsRes] = await Promise.all([
      this.supabase.client.from('courses').select('id', { count: 'exact', head: true }),
      this.supabase.client.from('lessons').select('completed')
    ]);
    if (coursesRes.error) throw coursesRes.error;
    if (lessonsRes.error) throw lessonsRes.error;
    const lessons = (lessonsRes.data ?? []) as { completed: boolean }[];
    return {
      courses: coursesRes.count ?? 0,
      lessons: lessons.length,
      completed: lessons.filter(l => l.completed).length
    };
  }

  async getCourse(id: string): Promise<Course | null> {
    const { data, error } = await this.supabase.client
      .from('courses')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async createCourse(input: { title: string; description?: string }): Promise<Course> {
    const userId = (await this.supabase.client.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('Not authenticated');
    const { data, error } = await this.supabase.client
      .from('courses')
      .insert({ title: input.title, description: input.description ?? null, user_id: userId })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateCourse(id: string, patch: Partial<Pick<Course, 'title' | 'description'>>): Promise<void> {
    const { error } = await this.supabase.client.from('courses').update(patch).eq('id', id);
    if (error) throw error;
  }

  async deleteCourse(id: string): Promise<void> {
    const { error } = await this.supabase.client.from('courses').delete().eq('id', id);
    if (error) throw error;
  }

  async listLessons(courseId: string): Promise<Lesson[]> {
    const { data, error } = await this.supabase.client
      .from('lessons')
      .select('*')
      .eq('course_id', courseId)
      .order('position', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async createLesson(input: { course_id: string; title: string; content?: string; video_url?: string; position?: number }): Promise<Lesson> {
    const userId = (await this.supabase.client.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('Not authenticated');
    const { data, error } = await this.supabase.client
      .from('lessons')
      .insert({
        course_id: input.course_id,
        user_id: userId,
        title: input.title,
        content: input.content ?? null,
        video_url: input.video_url ?? null,
        position: input.position ?? 0
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateLesson(id: string, patch: Partial<Pick<Lesson, 'title' | 'content' | 'video_url' | 'position' | 'completed'>>): Promise<void> {
    const { error } = await this.supabase.client.from('lessons').update(patch).eq('id', id);
    if (error) throw error;
  }

  async setLessonCompleted(id: string, completed: boolean): Promise<void> {
    return this.updateLesson(id, { completed });
  }

  async deleteLesson(id: string): Promise<void> {
    const { error } = await this.supabase.client.from('lessons').delete().eq('id', id);
    if (error) throw error;
  }
}
