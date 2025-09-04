export interface User {
  address: string;
  role: 'chef' | 'restaurant' | 'both';
  reputation: number;
  completedShifts: number;
  totalEarned: string;
}

export interface UserProfile {
  address: string;
  name?: string;
  bio?: string;
  skills?: string[];
  experience?: string;
  avatar?: string;
}