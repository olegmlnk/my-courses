import { Injectable, signal } from '@angular/core';
import { FriendEntry, Friendship, UserSearchResult } from './models';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class FriendsService {
  private readonly _friends = signal<FriendEntry[]>([]);
  private readonly _incoming = signal<FriendEntry[]>([]);
  private readonly _outgoing = signal<FriendEntry[]>([]);

  readonly friends = this._friends.asReadonly();
  readonly incoming = this._incoming.asReadonly();
  readonly outgoing = this._outgoing.asReadonly();

  constructor(private supabase: SupabaseService) {}

  async search(query: string): Promise<UserSearchResult[]> {
    const q = query.trim();
    if (q.length < 2) return [];
    const { data, error } = await this.supabase.client.rpc('search_users', { q });
    if (error) throw error;
    return (data ?? []) as UserSearchResult[];
  }

  async loadAll(): Promise<void> {
    const me = (await this.supabase.client.auth.getUser()).data.user?.id;
    if (!me) {
      this._friends.set([]);
      this._incoming.set([]);
      this._outgoing.set([]);
      return;
    }

    const { data: rows, error } = await this.supabase.client
      .from('friendships')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const friendships = (rows ?? []) as Friendship[];
    const otherIds = Array.from(
      new Set(friendships.map(f => (f.requester_id === me ? f.addressee_id : f.requester_id)))
    );

    let profilesMap = new Map<string, { nickname: string | null; avatar_url: string | null }>();
    if (otherIds.length) {
      const { data: profiles, error: pErr } = await this.supabase.client
        .from('profiles')
        .select('id, nickname, avatar_url')
        .in('id', otherIds);
      if (pErr) throw pErr;
      profilesMap = new Map((profiles ?? []).map(p => [p.id, { nickname: p.nickname, avatar_url: p.avatar_url }]));
    }

    const accepted: FriendEntry[] = [];
    const incoming: FriendEntry[] = [];
    const outgoing: FriendEntry[] = [];

    for (const f of friendships) {
      const otherId = f.requester_id === me ? f.addressee_id : f.requester_id;
      const profile = profilesMap.get(otherId) ?? { nickname: null, avatar_url: null };
      const entry: FriendEntry = {
        friendship_id: f.id,
        user: { id: otherId, nickname: profile.nickname, avatar_url: profile.avatar_url },
        status: f.status,
        direction: f.requester_id === me ? 'outgoing' : 'incoming',
        created_at: f.created_at
      };
      if (f.status === 'accepted') {
        accepted.push({ ...entry, direction: 'mutual' });
      } else if (f.status === 'pending') {
        if (entry.direction === 'incoming') incoming.push(entry);
        else outgoing.push(entry);
      }
    }

    this._friends.set(accepted);
    this._incoming.set(incoming);
    this._outgoing.set(outgoing);
  }

  async sendRequest(addresseeId: string): Promise<void> {
    const me = (await this.supabase.client.auth.getUser()).data.user?.id;
    if (!me) throw new Error('Not authenticated');
    if (me === addresseeId) throw new Error('Не можна додати себе');

    const { data: existing } = await this.supabase.client
      .from('friendships')
      .select('*')
      .or(`and(requester_id.eq.${me},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${me})`)
      .maybeSingle();

    if (existing) {
      if ((existing as Friendship).status === 'rejected' && (existing as Friendship).requester_id === me) {
        const { error } = await this.supabase.client
          .from('friendships')
          .update({ status: 'pending', updated_at: new Date().toISOString() })
          .eq('id', (existing as Friendship).id);
        if (error) throw error;
        await this.loadAll();
        return;
      }
      throw new Error('Запит уже існує або ви вже друзі');
    }

    const { error } = await this.supabase.client
      .from('friendships')
      .insert({ requester_id: me, addressee_id: addresseeId, status: 'pending' });
    if (error) throw error;
    await this.loadAll();
  }

  async accept(friendshipId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('friendships')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', friendshipId);
    if (error) throw error;
    await this.loadAll();
  }

  async reject(friendshipId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('friendships')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', friendshipId);
    if (error) throw error;
    await this.loadAll();
  }

  async remove(friendshipId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('friendships')
      .delete()
      .eq('id', friendshipId);
    if (error) throw error;
    await this.loadAll();
  }

  async relationWith(otherId: string): Promise<Friendship | null> {
    const me = (await this.supabase.client.auth.getUser()).data.user?.id;
    if (!me) return null;
    const { data } = await this.supabase.client
      .from('friendships')
      .select('*')
      .or(`and(requester_id.eq.${me},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${me})`)
      .maybeSingle();
    return (data as Friendship) ?? null;
  }

  clear() {
    this._friends.set([]);
    this._incoming.set([]);
    this._outgoing.set([]);
  }
}
