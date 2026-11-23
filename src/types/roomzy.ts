export interface CityInfo {
  name: string;
  state: string;
  center: { lat: number; lng: number };
  localities: string[];
}

export const INDIAN_CITIES: CityInfo[] = [
  {
    name: 'Bangalore',
    state: 'Karnataka',
    center: { lat: 12.9716, lng: 77.5946 },
    localities: ['Indiranagar', 'Koramangala', 'HSR Layout', 'Whitefield', 'Bellandur', 'Jayanagar', 'Marathahalli', 'Electronic City'],
  },
  {
    name: 'Mumbai',
    state: 'Maharashtra',
    center: { lat: 19.076, lng: 72.8777 },
    localities: ['Bandra West', 'Andheri West', 'Powai', 'Lower Parel', 'Malad', 'Goregaon', 'Chembur', 'Thane West'],
  },
  {
    name: 'Pune',
    state: 'Maharashtra',
    center: { lat: 18.5204, lng: 73.8567 },
    localities: ['Koregaon Park', 'Kalyani Nagar', 'Baner', 'Hinjewadi', 'Viman Nagar', 'Wakad', 'Kothrud', 'Aundh'],
  },
  {
    name: 'Delhi NCR',
    state: 'Delhi',
    center: { lat: 28.6139, lng: 77.209 },
    localities: ['Hauz Khas', 'Saket', 'Malviya Nagar', 'Lajpat Nagar', 'Dwarka', 'Vasant Kunj', 'North Campus', 'Karol Bagh'],
  },
  {
    name: 'Hyderabad',
    state: 'Telangana',
    center: { lat: 17.385, lng: 78.4867 },
    localities: ['Gachibowli', 'Kondapur', 'Madhapur', 'Jubilee Hills', 'Banjara Hills', 'HITEC City', 'Kukatpally', 'Manikonda'],
  },
  {
    name: 'Chennai',
    state: 'Tamil Nadu',
    center: { lat: 13.0827, lng: 80.2707 },
    localities: ['Adyar', 'Velachery', 'OMR Thoraipakkam', 'Anna Nagar', 'T. Nagar', 'Besant Nagar', 'Nungambakkam', 'Guindy'],
  },
  {
    name: 'Gurgaon',
    state: 'Haryana',
    center: { lat: 28.4595, lng: 77.0266 },
    localities: ['DLF Phase 3', 'DLF Phase 4', 'Cyber City', 'Sohna Road', 'Golf Course Road', 'Sector 56', 'Sector 49', 'MG Road'],
  },
  {
    name: 'Noida',
    state: 'Uttar Pradesh',
    center: { lat: 28.5355, lng: 77.391 },
    localities: ['Sector 62', 'Sector 18', 'Sector 137', 'Sector 76', 'Sector 50', 'Greater Noida West', 'Sector 44', 'Sector 128'],
  },
  {
    name: 'Lucknow',
    state: 'Uttar Pradesh',
    center: { lat: 26.8467, lng: 80.9462 },
    localities: ['Gomti Nagar', 'Hazratganj', 'Indira Nagar', 'Aliganj', 'Mahanagar', 'Jankipuram', 'Sushant Golf City', 'Vikas Nagar'],
  },
  {
    name: 'Kolkata',
    state: 'West Bengal',
    center: { lat: 22.5726, lng: 88.3639 },
    localities: ['Salt Lake Sector V', 'New Town', 'Ballygunge', 'Park Street', 'Jadavpur', 'Tollygunge', 'Rajarhat', 'Behala'],
  },
];

export const AMENITY_OPTIONS = [
  'High-Speed Wi-Fi',
  'AC',
  'Washing Machine',
  'Refrigerator',
  'Maid & Cook',
  'Power Backup',
  'Gated Security',
  'Parking',
  'Gym',
  'Attached Bathroom',
  'Balcony',
  'Water Purifier',
];

export type GenderOption = 'Male' | 'Female' | 'Non-Binary' | 'Prefer not to say';
export type OccupancyOption = 'Private Room' | 'Shared Room' | 'Entire Flat' | 'Any';
export type HabitLevel = 'Never' | 'Socially' | 'Regularly';
export type PetOption = 'No Pets' | 'Pet Friendly' | 'Have a Pet';
export type FoodOption = 'Vegetarian' | 'Eggetarian' | 'Non-Vegetarian' | 'Vegan' | 'Jain';
export type SleepOption = 'Early Bird' | 'Balanced' | 'Night Owl';
export type WorkModeOption = 'Work From Office' | 'Hybrid' | 'Work From Home' | 'Student';
export type CleanlinessOption = 'Neat Freak' | 'Moderately Clean' | 'Relaxed';
export type PartyOption = 'Never' | 'Occasionally' | 'Weekends';
export type GuestOption = 'No Guests' | 'Occasional Daytime' | 'Overnight OK';

export interface UserAccount {
  uid: string;
  email?: string;
  phone?: string;
  fullName: string;
  subscriptionTier: 'free' | 'premium';
  subscriptionPlan: 'none' | 'monthly' | 'quarterly' | 'annual';
  subscriptionExpiresAt?: string;
  superLikesRemaining: number;
  dailyLikesCount: number;
  lastLikeDate?: string;
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected';
  onboardingComplete: boolean;
  isSuspended: boolean;
  isBanned: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface FlatmateProfile {
  uid: string;
  fullName: string;
  photoUrl?: string;
  age: number;
  gender: GenderOption;
  profession: string;
  companyOrCollege?: string;
  currentCity?: string;
  preferredCity: string;
  preferredLocality: string;
  monthlyBudget: number;
  moveInDate: string;
  occupancyPreference: OccupancyOption;
  smoking: HabitLevel;
  drinking: HabitLevel;
  pets: PetOption;
  foodPreference: FoodOption;
  sleepSchedule: SleepOption;
  workMode: WorkModeOption;
  cleanliness: CleanlinessOption;
  partyFrequency: PartyOption;
  guestPreference: GuestOption;
  aboutMe?: string;
  isVerified: boolean;
  isPriority: boolean;
  isActive: boolean;
  profileCompletion: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PropertyListing {
  id?: string;
  ownerUid: string;
  ownerName: string;
  ownerVerified: boolean;
  title: string;
  description: string;
  city: string;
  locality: string;
  lat?: number;
  lng?: number;
  monthlyRent: number;
  securityDeposit: number;
  maintenanceCharges: number;
  availableRooms: number;
  furnishing: 'Fully Furnished' | 'Semi-Furnished' | 'Unfurnished';
  amenities: string[];
  preferredTenant: 'Any' | 'Male Only' | 'Female Only' | 'Working Professionals' | 'Students';
  availableFrom: string;
  images: string[];
  isFeatured: boolean;
  status: 'active' | 'inactive' | 'moderation_removed';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LikeRecord {
  id?: string;
  fromUid: string;
  toUid: string;
  type: 'like' | 'pass' | 'superlike';
  createdAt?: unknown;
}

export interface MatchRecord {
  id?: string;
  users: string[];
  user1Uid: string;
  user2Uid: string;
  compatibilityScore: number;
  status: 'matched' | 'unmatched' | 'blocked';
  blockedBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ConversationRecord {
  id?: string;
  participants: string[];
  matchId?: string;
  listingId?: string;
  lastMessage?: string;
  lastMessageAt?: unknown;
  blockedBy?: string;
  typingUsers?: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ChatMessage {
  id?: string;
  senderUid: string;
  text?: string;
  imageUrl?: string;
  readBy: string[];
  createdAt?: unknown;
}

export interface AppNotification {
  id?: string;
  uid: string;
  type: 'match' | 'message' | 'like' | 'inquiry' | 'verification' | 'subscription';
  title: string;
  body: string;
  linkTab?: string;
  isRead: boolean;
  createdAt?: unknown;
}

export interface VerificationRecord {
  id?: string;
  uid: string;
  type: 'phone' | 'email' | 'govt_id';
  provider: string;
  documentType: 'Aadhaar' | 'PAN' | 'Passport' | 'Driving License' | 'Phone OTP' | 'Email';
  documentLast4?: string;
  status: 'pending' | 'verified' | 'rejected';
  notes?: string;
  reviewedBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SafetyReport {
  id?: string;
  reporterUid: string;
  targetUid: string;
  targetType: 'user' | 'listing';
  targetId: string;
  reason: string;
  details?: string;
  status: 'open' | 'resolved' | 'dismissed';
  resolvedBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type AppTab =
  | 'dashboard'
  | 'discover'
  | 'matches'
  | 'messages'
  | 'rooms'
  | 'profile'
  | 'premium'
  | 'verification'
  | 'admin';

export const ADMIN_EMAIL = 'tripathiravindra212@gmail.com';
