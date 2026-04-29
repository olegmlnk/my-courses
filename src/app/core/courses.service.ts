import { Injectable } from '@angular/core';
import { Course, CourseVisibility, CourseWithProgress, Lesson, LessonProgress } from './models';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class CoursesService {
  constructor(private supabase: SupabaseService) {}

  private async currentUserId(): Promise<string | null> {
    return (await this.supabase.client.auth.getUser()).data.user?.id ?? null;
  }

  async listCourses(): Promise<Course[]> {
    const { data, error } = await this.supabase.client
      .from('courses')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async listCoursesWithProgress(): Promise<CourseWithProgress[]> {
    const me = await this.currentUserId();
    if (!me) throw new Error('Not authenticated');

    const [coursesRes, lessonsRes, progressRes] = await Promise.all([
      this.supabase.client.from('courses').select('*').order('created_at', { ascending: false }),
      this.supabase.client.from('lessons').select('id, course_id'),
      this.supabase.client.from('lesson_progress').select('lesson_id, completed').eq('user_id', me)
    ]);
    if (coursesRes.error) throw coursesRes.error;
    if (lessonsRes.error) throw lessonsRes.error;
    if (progressRes.error) throw progressRes.error;

    const completedLessonIds = new Set(
      ((progressRes.data ?? []) as { lesson_id: string; completed: boolean }[])
        .filter(p => p.completed)
        .map(p => p.lesson_id)
    );

    const totalsByCourse = new Map<string, { total: number; done: number }>();
    for (const l of (lessonsRes.data ?? []) as { id: string; course_id: string }[]) {
      const s = totalsByCourse.get(l.course_id) ?? { total: 0, done: 0 };
      s.total++;
      if (completedLessonIds.has(l.id)) s.done++;
      totalsByCourse.set(l.course_id, s);
    }

    const courses = (coursesRes.data ?? []) as Course[];
    const otherOwnerIds = Array.from(
      new Set(courses.filter(c => c.user_id !== me).map(c => c.user_id))
    );
    let ownersMap = new Map<string, { nickname: string | null; avatar_url: string | null }>();
    if (otherOwnerIds.length) {
      const { data: profiles, error: pErr } = await this.supabase.client
        .from('profiles')
        .select('id, nickname, avatar_url')
        .in('id', otherOwnerIds);
      if (pErr) throw pErr;
      ownersMap = new Map((profiles ?? []).map(p => [p.id, { nickname: p.nickname, avatar_url: p.avatar_url }]));
    }

    return courses.map(c => {
      const owner = ownersMap.get(c.user_id);
      return {
        ...c,
        total_lessons: totalsByCourse.get(c.id)?.total ?? 0,
        completed_lessons: totalsByCourse.get(c.id)?.done ?? 0,
        is_own: c.user_id === me,
        owner_nickname: owner?.nickname ?? null,
        owner_avatar_url: owner?.avatar_url ?? null
      };
    });
  }

  async overallStats(): Promise<{ courses: number; lessons: number; completed: number }> {
    const me = await this.currentUserId();
    if (!me) return { courses: 0, lessons: 0, completed: 0 };

    const [coursesRes, lessonsRes, progressRes] = await Promise.all([
      this.supabase.client.from('courses').select('id', { count: 'exact', head: true }).eq('user_id', me),
      this.supabase.client.from('lessons').select('id', { count: 'exact', head: true }).eq('user_id', me),
      this.supabase.client.from('lesson_progress').select('lesson_id', { count: 'exact', head: true }).eq('user_id', me).eq('completed', true)
    ]);
    if (coursesRes.error) throw coursesRes.error;
    if (lessonsRes.error) throw lessonsRes.error;
    if (progressRes.error) throw progressRes.error;

    return {
      courses: coursesRes.count ?? 0,
      lessons: lessonsRes.count ?? 0,
      completed: progressRes.count ?? 0
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

  async getCourseOwner(userId: string): Promise<{ nickname: string | null; avatar_url: string | null } | null> {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('nickname, avatar_url')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async createCourse(input: { title: string; description?: string }): Promise<Course> {
    const userId = await this.currentUserId();
    if (!userId) throw new Error('Not authenticated');
    const { data, error } = await this.supabase.client
      .from('courses')
      .insert({ title: input.title, description: input.description ?? null, user_id: userId, visibility: 'private' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateCourse(id: string, patch: Partial<Pick<Course, 'title' | 'description' | 'visibility'>>): Promise<void> {
    const { error } = await this.supabase.client.from('courses').update(patch).eq('id', id);
    if (error) throw error;
  }

  async setVisibility(id: string, visibility: CourseVisibility): Promise<void> {
    return this.updateCourse(id, { visibility });
  }

  async deleteCourse(id: string): Promise<void> {
    const { error } = await this.supabase.client.from('courses').delete().eq('id', id);
    if (error) throw error;
  }

  async listLessons(courseId: string): Promise<Lesson[]> {
    const { data, error } = await this.supabase.client
      .from('lessons')
      .select('id, course_id, user_id, title, content, video_url, position, created_at')
      .eq('course_id', courseId)
      .order('position', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Lesson[];
  }

  async listMyProgressForCourse(courseId: string): Promise<Set<string>> {
    const me = await this.currentUserId();
    if (!me) return new Set();
    const { data: lessonRows, error: lErr } = await this.supabase.client
      .from('lessons')
      .select('id')
      .eq('course_id', courseId);
    if (lErr) throw lErr;
    const ids = (lessonRows ?? []).map(l => l.id);
    if (!ids.length) return new Set();
    const { data, error } = await this.supabase.client
      .from('lesson_progress')
      .select('lesson_id')
      .eq('user_id', me)
      .eq('completed', true)
      .in('lesson_id', ids);
    if (error) throw error;
    return new Set((data ?? []).map((r: { lesson_id: string }) => r.lesson_id));
  }

  async createLesson(input: { course_id: string; title: string; content?: string; video_url?: string; position?: number }): Promise<Lesson> {
    const userId = await this.currentUserId();
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
      .select('id, course_id, user_id, title, content, video_url, position, created_at')
      .single();
    if (error) throw error;
    return data as Lesson;
  }

  async updateLesson(id: string, patch: Partial<Pick<Lesson, 'title' | 'content' | 'video_url' | 'position'>>): Promise<void> {
    const { error } = await this.supabase.client.from('lessons').update(patch).eq('id', id);
    if (error) throw error;
  }

  async setLessonCompleted(lessonId: string, completed: boolean): Promise<void> {
    const userId = await this.currentUserId();
    if (!userId) throw new Error('Not authenticated');
    if (completed) {
      const { error } = await this.supabase.client
        .from('lesson_progress')
        .upsert({ user_id: userId, lesson_id: lessonId, completed: true, completed_at: new Date().toISOString() });
      if (error) throw error;
    } else {
      const { error } = await this.supabase.client
        .from('lesson_progress')
        .delete()
        .eq('user_id', userId)
        .eq('lesson_id', lessonId);
      if (error) throw error;
    }
  }

  async deleteLesson(id: string): Promise<void> {
    const { error } = await this.supabase.client.from('lessons').delete().eq('id', id);
    if (error) throw error;
  }
}
