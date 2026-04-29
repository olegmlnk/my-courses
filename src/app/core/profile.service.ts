import { Injectable, signal } from '@angular/core';
import { Profile } from './models';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly _profile = signal<Profile | null>(null);
  readonly profile = this._profile.asReadonly();

  constructor(private supabase: SupabaseService) {}

  async load(): Promise<Profile | null> {
    const userId = (await this.supabase.client.auth.getUser()).data.user?.id;
    if (!userId) { this._profile.set(null); return null; }
    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      const { data: created, error: insErr } = await this.supabase.client
        .from('profiles')
        .insert({ id: userId })
        .select()
        .single();
      if (insErr) throw insErr;
      this._profile.set(created);
      return created;
    }
    this._profile.set(data);
    return data;
  }

  async update(patch: Partial<Pick<Profile, 'nickname' | 'avatar_url'>>): Promise<void> {
    const userId = (await this.supabase.client.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('Not authenticated');
    const { data, error } = await this.supabase.client
      .from('profiles')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    this._profile.set(data);
  }

  async updateEmail(email: string) {
    return this.supabase.client.auth.updateUser({ email });
  }

  async updatePassword(password: string) {
    return this.supabase.client.auth.updateUser({ password });
  }

  async uploadAvatar(file: File): Promise<string> {
    const userId = (await this.supabase.client.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('Not authenticated');
    if (!file.type.startsWith('image/')) throw new Error('Файл має бути зображенням');
    if (file.size > 5 * 1024 * 1024) throw new Error('Розмір не більше 5 МБ');
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    const { error } = await this.supabase.client.storage
      .from('avatars')
      .upload(path, file, { upsert: true, cacheControl: '3600' });
    if (error) throw error;
    const { data } = this.supabase.client.storage.from('avatars').getPublicUrl(path);
    await this.update({ avatar_url: data.publicUrl });
    return data.publicUrl;
  }

  async deleteAccount() {
    const { error } = await this.supabase.client.rpc('delete_my_user');
    if (error) throw error;
    await this.supabase.client.auth.signOut();
  }

  clear() { this._profile.set(null); }
}
