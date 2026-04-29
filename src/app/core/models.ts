export interface Course {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
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
  completed: boolean;
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
}
