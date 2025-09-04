export interface Shift {
  id: number;
  title: string;
  description: string;
  restaurantName: string;
  restaurantAddress?: string;
  payment: string;
  startTime: string;
  endTime: string;
  status: 'open' | 'filled' | 'completed';
  requirements?: string[];
  applications?: number;
  postedAt?: string;
}

export interface Application {
  id: number;
  shiftId: number;
  shiftTitle: string;
  restaurantName: string;
  payment: string;
  status: 'pending' | 'accepted' | 'rejected';
  appliedAt: string;
  selectedChef?: string;
}

export interface CompletedShift {
  id: number;
  shiftTitle: string;
  restaurantName: string;
  payment: string;
  completedAt: string;
  rating: number;
}