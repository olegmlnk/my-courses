import { Injectable, signal } from '@angular/core';
import { StreakInfo } from './models';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class StreakService {
  private readonly _streak = signal<StreakInfo>({ current_streak: 0, longest_streak: 0, today_count: 0 });
  readonly streak = this._streak.asReadonly();

  constructor(private supabase: SupabaseService) {}

  async load(): Promise<StreakInfo> {
    const { data, error } = await this.supabase.client.rpc('get_my_streak');
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    const info: StreakInfo = row ?? { current_streak: 0, longest_streak: 0, today_count: 0 };
    this._streak.set(info);
    return info;
  }

  clear() { this._streak.set({ current_streak: 0, longest_streak: 0, today_count: 0 }); }
}
