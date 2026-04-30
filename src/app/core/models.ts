export type CourseVisibility = 'private' | 'friends' | 'public';

export interface Course {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  visibility: CourseVisibility;
  created_at: string;
}

export interface Lesson {
  id: string;
  course_id: string;
  user_id: string;
  title: string;
  content: string | null;
  video_url: string | null;
  position: number;
  created_at: string;
}

export interface Profile {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CourseWithProgress extends Course {
  total_lessons: number;
  completed_lessons: number;
  owner_nickname?: string | null;
  owner_avatar_url?: string | null;
  is_own: boolean;
}

export type FriendshipStatus = 'pending' | 'accepted' | 'rejected';

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
}

export interface UserSearchResult {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
  matched_by: 'nickname' | 'email';
}

export interface FriendEntry {
  friendship_id: string;
  user: { id: string; nickname: string | null; avatar_url: string | null };
  status: FriendshipStatus;
  direction: 'incoming' | 'outgoing' | 'mutual';
  created_at: string;
}

export interface LessonProgress {
  user_id: string;
  lesson_id: string;
  completed: boolean;
  completed_at: string;
}

export interface LessonBookmark {
  id: string;
  user_id: string;
  lesson_id: string;
  timestamp_seconds: number;
  note: string | null;
  created_at: string;
}

export interface StreakInfo {
  current_streak: number;
  longest_streak: number;
  today_count: number;
}
