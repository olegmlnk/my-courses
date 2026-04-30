import { Injectable } from '@angular/core';
import { LessonBookmark } from './models';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class BookmarksService {
  constructor(private supabase: SupabaseService) {}

  async listForLessons(lessonIds: string[]): Promise<LessonBookmark[]> {
    if (!lessonIds.length) return [];
    const me = (await this.supabase.client.auth.getUser()).data.user?.id;
    if (!me) return [];
    const { data, error } = await this.supabase.client
      .from('lesson_bookmarks')
      .select('*')
      .eq('user_id', me)
      .in('lesson_id', lessonIds)
      .order('timestamp_seconds', { ascending: true });
    if (error) throw error;
    return (data ?? []) as LessonBookmark[];
  }

  async add(lessonId: string, timestampSeconds: number, note: string | null): Promise<LessonBookmark> {
    const me = (await this.supabase.client.auth.getUser()).data.user?.id;
    if (!me) throw new Error('Not authenticated');
    const { data, error } = await this.supabase.client
      .from('lesson_bookmarks')
      .insert({
        user_id: me,
        lesson_id: lessonId,
        timestamp_seconds: Math.max(0, Math.floor(timestampSeconds)),
        note: note?.trim() || null
      })
      .select()
      .single();
    if (error) throw error;
    return data as LessonBookmark;
  }

  async update(id: string, patch: { note?: string | null; timestamp_seconds?: number }): Promise<void> {
    const { error } = await this.supabase.client.from('lesson_bookmarks').update(patch).eq('id', id);
    if (error) throw error;
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase.client.from('lesson_bookmarks').delete().eq('id', id);
    if (error) throw error;
  }
}
