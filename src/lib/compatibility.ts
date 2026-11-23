import { FlatmateProfile } from '../types/roomzy';

export interface CompatibilityResult {
  score: number;
  label: string;
  reasons: string[];
  mismatches: string[];
}

export function computeCompatibility(
  me: FlatmateProfile | null,
  candidate: FlatmateProfile
): CompatibilityResult {
  if (!me || me.uid === candidate.uid) {
    return {
      score: 100,
      label: 'Your Profile',
      reasons: [],
      mismatches: [],
    };
  }

  let total = 0;
  const reasons: string[] = [];
  const mismatches: string[] = [];

  // 1. Budget Compatibility (20 pts)
  const maxBudget = Math.max(me.monthlyBudget, candidate.monthlyBudget);
  const diffRatio = maxBudget > 0 ? Math.abs(me.monthlyBudget - candidate.monthlyBudget) / maxBudget : 0;
  if (diffRatio <= 0.15) {
    total += 20;
    reasons.push('Aligned monthly budget');
  } else if (diffRatio <= 0.3) {
    total += 14;
    reasons.push('Close budget range');
  } else if (diffRatio <= 0.5) {
    total += 8;
  } else {
    total += 2;
    mismatches.push('Different budget expectations');
  }

  // 2. City & Locality (18 pts)
  if (me.preferredCity.toLowerCase() === candidate.preferredCity.toLowerCase()) {
    total += 10;
    const locA = me.preferredLocality.toLowerCase().trim();
    const locB = candidate.preferredLocality.toLowerCase().trim();
    if (locA === locB || locA.includes(locB) || locB.includes(locA)) {
      total += 8;
      reasons.push(`Same preferred hub (${candidate.preferredLocality})`);
    } else {
      total += 4;
      reasons.push(`Both looking in ${candidate.preferredCity}`);
    }
  } else {
    mismatches.push(`Different target city (${candidate.preferredCity})`);
  }

  // 3. Sleep Schedule (12 pts)
  if (me.sleepSchedule === candidate.sleepSchedule) {
    total += 12;
    reasons.push(`Both ${candidate.sleepSchedule.toLowerCase()}s`);
  } else if (me.sleepSchedule === 'Balanced' || candidate.sleepSchedule === 'Balanced') {
    total += 7;
  } else {
    total += 2;
    mismatches.push('Opposite sleep schedules');
  }

  // 4. Cleanliness Habits (12 pts)
  if (me.cleanliness === candidate.cleanliness) {
    total += 12;
    reasons.push(`${candidate.cleanliness} living standard`);
  } else if (me.cleanliness === 'Moderately Clean' || candidate.cleanliness === 'Moderately Clean') {
    total += 7;
  } else {
    total += 2;
    mismatches.push('Cleanliness expectations differ');
  }

  // 5. Smoking & Drinking (12 pts)
  if (me.smoking === candidate.smoking) {
    total += 6;
    if (me.smoking === 'Never') reasons.push('Non-smoking home');
  } else if (me.smoking === 'Socially' || candidate.smoking === 'Socially') {
    total += 3;
  } else {
    mismatches.push('Smoking preference mismatch');
  }

  if (me.drinking === candidate.drinking) {
    total += 6;
  } else if (me.drinking === 'Socially' || candidate.drinking === 'Socially') {
    total += 3;
  } else {
    mismatches.push('Drinking habits differ');
  }

  // 6. Food Preference (10 pts)
  if (me.foodPreference === candidate.foodPreference) {
    total += 10;
    reasons.push(`Shared ${candidate.foodPreference} kitchen`);
  } else if (
    (me.foodPreference === 'Vegetarian' && (candidate.foodPreference === 'Eggetarian' || candidate.foodPreference === 'Jain' || candidate.foodPreference === 'Vegan')) ||
    (candidate.foodPreference === 'Vegetarian' && (me.foodPreference === 'Eggetarian' || me.foodPreference === 'Jain' || me.foodPreference === 'Vegan'))
  ) {
    total += 6;
  } else {
    total += 3;
  }

  // 7. Work Schedule (6 pts)
  if (me.workMode === candidate.workMode) {
    total += 6;
    reasons.push(`Both ${candidate.workMode}`);
  } else {
    total += 3;
  }

  // 8. Pets (5 pts)
  if (me.pets === candidate.pets || (me.pets !== 'No Pets' && candidate.pets !== 'No Pets')) {
    total += 5;
  } else if (me.pets === 'No Pets' && candidate.pets === 'Have a Pet') {
    total += 1;
    mismatches.push('Has a pet');
  } else {
    total += 3;
  }

  // 9. Move-in Date & Guests/Party (5 pts)
  if (me.partyFrequency === candidate.partyFrequency) total += 2.5;
  else total += 1;
  if (me.guestPreference === candidate.guestPreference) total += 2.5;
  else total += 1;

  const score = Math.min(99, Math.max(35, Math.round(total)));
  const label =
    score >= 88
      ? `${score}% Lifestyle Match`
      : score >= 75
        ? `${score}% Strong Match`
        : score >= 60
          ? `${score}% Good Fit`
          : `${score}% Partial Fit`;

  return {
    score,
    label,
    reasons: reasons.slice(0, 4),
    mismatches: mismatches.slice(0, 2),
  };
}

export function calculateProfileCompletion(profile: Partial<FlatmateProfile>): number {
  const fields: (keyof FlatmateProfile)[] = [
    'fullName',
    'photoUrl',
    'age',
    'gender',
    'profession',
    'companyOrCollege',
    'currentCity',
    'preferredCity',
    'preferredLocality',
    'monthlyBudget',
    'moveInDate',
    'occupancyPreference',
    'smoking',
    'drinking',
    'pets',
    'foodPreference',
    'sleepSchedule',
    'workMode',
    'cleanliness',
    'partyFrequency',
    'guestPreference',
    'aboutMe',
  ];
  const filled = fields.filter((f) => {
    const val = profile[f];
    return val !== undefined && val !== null && String(val).trim().length > 0;
  }).length;
  return Math.round((filled / fields.length) * 100);
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}
