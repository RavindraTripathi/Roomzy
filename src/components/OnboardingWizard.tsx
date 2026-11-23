import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ArrowLeft, ArrowRight, Check, Loader2, Upload } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { calculateProfileCompletion, formatINR } from '../lib/compatibility';
import {
  CleanlinessOption,
  FlatmateProfile,
  FoodOption,
  GenderOption,
  GuestOption,
  HabitLevel,
  INDIAN_CITIES,
  OccupancyOption,
  PartyOption,
  PetOption,
  SleepOption,
  WorkModeOption,
} from '../types/roomzy';

interface OnboardingWizardProps {
  user: User;
  existingProfile: FlatmateProfile | null;
  onComplete: () => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  user,
  existingProfile,
  onComplete,
}) => {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState(existingProfile?.fullName || user.displayName || '');
  const [photoUrl, setPhotoUrl] = useState(existingProfile?.photoUrl || user.photoURL || '');
  const [age, setAge] = useState(existingProfile?.age || 24);
  const [gender, setGender] = useState<GenderOption>(existingProfile?.gender || 'Male');
  const [profession, setProfession] = useState(existingProfile?.profession || 'Software Engineer');
  const [companyOrCollege, setCompanyOrCollege] = useState(existingProfile?.companyOrCollege || '');

  const [currentCity, setCurrentCity] = useState(existingProfile?.currentCity || 'Bangalore');
  const [preferredCity, setPreferredCity] = useState(existingProfile?.preferredCity || 'Bangalore');
  const [preferredLocality, setPreferredLocality] = useState(
    existingProfile?.preferredLocality || 'Indiranagar'
  );
  const [monthlyBudget, setMonthlyBudget] = useState(existingProfile?.monthlyBudget || 18000);
  const [moveInDate, setMoveInDate] = useState(
    existingProfile?.moveInDate || new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10)
  );
  const [occupancyPreference, setOccupancyPreference] = useState<OccupancyOption>(
    existingProfile?.occupancyPreference || 'Private Room'
  );

  const [smoking, setSmoking] = useState<HabitLevel>(existingProfile?.smoking || 'Never');
  const [drinking, setDrinking] = useState<HabitLevel>(existingProfile?.drinking || 'Socially');
  const [pets, setPets] = useState<PetOption>(existingProfile?.pets || 'Pet Friendly');
  const [foodPreference, setFoodPreference] = useState<FoodOption>(
    existingProfile?.foodPreference || 'Non-Vegetarian'
  );
  const [sleepSchedule, setSleepSchedule] = useState<SleepOption>(
    existingProfile?.sleepSchedule || 'Balanced'
  );
  const [workMode, setWorkMode] = useState<WorkModeOption>(existingProfile?.workMode || 'Hybrid');

  const [cleanliness, setCleanliness] = useState<CleanlinessOption>(
    existingProfile?.cleanliness || 'Moderately Clean'
  );
  const [partyFrequency, setPartyFrequency] = useState<PartyOption>(
    existingProfile?.partyFrequency || 'Occasionally'
  );
  const [guestPreference, setGuestPreference] = useState<GuestOption>(
    existingProfile?.guestPreference || 'Occasional Daytime'
  );
  const [aboutMe, setAboutMe] = useState(existingProfile?.aboutMe || '');

  const selectedCityObj = INDIAN_CITIES.find((c) => c.name === preferredCity) || INDIAN_CITIES[0];

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500_000) {
      setError('Profile picture must be under 500KB or provide an HTTPS image URL.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string' && reader.result.length <= 1024) {
        setPhotoUrl(reader.result);
      } else {
        // Compress image to fit inside 1024-char limit or prompt URL
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 96;
          const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compact = canvas.toDataURL('image/jpeg', 0.6);
          if (compact.length <= 1024) {
            setPhotoUrl(compact);
          } else {
            setError('Please paste an image URL or upload a smaller photo.');
          }
        };
        img.src = reader.result as string;
      }
    };
    reader.readAsDataURL(file);
  };

  const validateStep = (): boolean => {
    setError(null);
    if (step === 1) {
      if (fullName.trim().length < 2) {
        setError('Please enter your full name (at least 2 characters).');
        return false;
      }
      if (age < 18 || age > 99) {
        setError('You must be 18 or older to join ROOMZY.');
        return false;
      }
      if (profession.trim().length < 2) {
        setError('Please enter your profession or student field.');
        return false;
      }
    }
    if (step === 2) {
      if (preferredLocality.trim().length < 2) {
        setError('Please select or enter a preferred locality.');
        return false;
      }
      if (monthlyBudget < 2000 || monthlyBudget > 500000) {
        setError('Monthly budget must be between ₹2,000 and ₹5,00,000.');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep()) return;
    setSaving(true);
    setError(null);

    try {
      const draft: Partial<FlatmateProfile> = {
        uid: user.uid,
        fullName: fullName.trim(),
        photoUrl: photoUrl.trim() || undefined,
        age: Number(age),
        gender,
        profession: profession.trim(),
        companyOrCollege: companyOrCollege.trim() || undefined,
        currentCity: currentCity.trim(),
        preferredCity,
        preferredLocality: preferredLocality.trim(),
        monthlyBudget: Number(monthlyBudget),
        moveInDate,
        occupancyPreference,
        smoking,
        drinking,
        pets,
        foodPreference,
        sleepSchedule,
        workMode,
        cleanliness,
        partyFrequency,
        guestPreference,
        aboutMe: aboutMe.trim() || undefined,
      };
      const profileCompletion = calculateProfileCompletion(draft);

      const profilePayload = {
        uid: user.uid,
        fullName: fullName.trim(),
        ...(photoUrl.trim() ? { photoUrl: photoUrl.trim() } : {}),
        age: Number(age),
        gender,
        profession: profession.trim(),
        ...(companyOrCollege.trim() ? { companyOrCollege: companyOrCollege.trim() } : {}),
        currentCity: currentCity.trim(),
        preferredCity,
        preferredLocality: preferredLocality.trim(),
        monthlyBudget: Number(monthlyBudget),
        moveInDate,
        occupancyPreference,
        smoking,
        drinking,
        pets,
        foodPreference,
        sleepSchedule,
        workMode,
        cleanliness,
        partyFrequency,
        guestPreference,
        ...(aboutMe.trim() ? { aboutMe: aboutMe.trim() } : {}),
        isVerified: existingProfile?.isVerified ?? false,
        isPriority: existingProfile?.isPriority ?? false,
        isActive: true,
        profileCompletion,
        createdAt: existingProfile?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      try {
        await setDoc(doc(db, 'profiles', user.uid), profilePayload, { merge: Boolean(existingProfile) });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `profiles/${user.uid}`);
      }

      try {
        await setDoc(
          doc(db, 'users', user.uid),
          {
            uid: user.uid,
            fullName: fullName.trim(),
            ...(user.email ? { email: user.email } : {}),
            ...(user.phoneNumber ? { phone: user.phoneNumber } : {}),
            onboardingComplete: true,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      }

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const progress = (step / 4) * 100;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-violet-700 font-display">ROOMZY Onboarding</span>
          <span className="text-xs font-medium text-slate-500 font-mono-num">Step {step} of 4</span>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-6">
          <div
            className="h-full bg-violet-700 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-1">
          {step === 1 && 'Tell us about yourself'}
          {step === 2 && 'Where and when are you moving?'}
          {step === 3 && 'Your daily lifestyle'}
          {step === 4 && 'Home etiquette & bio'}
        </h1>
        <p className="text-sm text-slate-600 mb-6">
          {step === 1 && 'Your name, age, and career help flatmates get to know you.'}
          {step === 2 && 'We match you with people looking in the same locality and budget.'}
          {step === 3 && 'Honest habits prevent awkward roommate conflicts later.'}
          {step === 4 && 'Fine-tune your living compatibility score.'}
        </p>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-violet-50 border border-violet-200 overflow-hidden flex items-center justify-center shrink-0">
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={fullName || 'Profile'}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-lg font-bold text-violet-700">
                      {(fullName || 'R')[0]?.toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 space-y-1.5">
                  <label className="block text-xs font-medium text-slate-700">
                    Profile Photo URL or Upload
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={photoUrl}
                      onChange={(e) => setPhotoUrl(e.target.value)}
                      placeholder="https://..."
                      className="flex-1 h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600"
                    />
                    <label className="h-10 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 inline-flex items-center gap-1.5 cursor-pointer shrink-0">
                      <Upload className="w-3.5 h-3.5" />
                      Upload
                      <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Age (18+) *</label>
                  <input
                    type="number"
                    min={18}
                    max={99}
                    required
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-violet-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Gender *</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as GenderOption)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-600"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Non-Binary">Non-Binary</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Profession *</label>
                  <input
                    type="text"
                    required
                    value={profession}
                    onChange={(e) => setProfession(e.target.value)}
                    placeholder="Product Designer / MBA Student"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Company or College (Optional)
                </label>
                <input
                  type="text"
                  value={companyOrCollege}
                  onChange={(e) => setCompanyOrCollege(e.target.value)}
                  placeholder="e.g., Flipkart, IIM Bangalore, TCS"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Current City</label>
                  <input
                    type="text"
                    value={currentCity}
                    onChange={(e) => setCurrentCity(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Preferred City *</label>
                  <select
                    value={preferredCity}
                    onChange={(e) => {
                      const next = e.target.value;
                      setPreferredCity(next);
                      const found = INDIAN_CITIES.find((c) => c.name === next);
                      if (found) setPreferredLocality(found.localities[0]);
                    }}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-600"
                  >
                    {INDIAN_CITIES.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Preferred Locality in {preferredCity} *
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {selectedCityObj.localities.map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => setPreferredLocality(loc)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        preferredLocality === loc
                          ? 'bg-violet-700 text-white border-violet-700'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-violet-300'
                      }`}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  required
                  value={preferredLocality}
                  onChange={(e) => setPreferredLocality(e.target.value)}
                  placeholder="Or type another neighborhood"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span>Monthly Rental Budget *</span>
                  <span className="font-mono-num font-bold text-violet-700">
                    {formatINR(monthlyBudget)} / month
                  </span>
                </div>
                <input
                  type="range"
                  min={5000}
                  max={80000}
                  step={1000}
                  value={monthlyBudget}
                  onChange={(e) => setMonthlyBudget(Number(e.target.value))}
                  className="w-full accent-violet-700"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Move-in Date *</label>
                  <input
                    type="date"
                    required
                    value={moveInDate}
                    onChange={(e) => setMoveInDate(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Occupancy Preference *
                  </label>
                  <select
                    value={occupancyPreference}
                    onChange={(e) => setOccupancyPreference(e.target.value as OccupancyOption)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-600"
                  >
                    <option value="Private Room">Private Room</option>
                    <option value="Shared Room">Shared Room</option>
                    <option value="Entire Flat">Entire Flat</option>
                    <option value="Any">Any</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Smoking</label>
                <select
                  value={smoking}
                  onChange={(e) => setSmoking(e.target.value as HabitLevel)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm bg-white"
                >
                  <option value="Never">Never</option>
                  <option value="Socially">Socially</option>
                  <option value="Regularly">Regularly</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Drinking</label>
                <select
                  value={drinking}
                  onChange={(e) => setDrinking(e.target.value as HabitLevel)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm bg-white"
                >
                  <option value="Never">Never</option>
                  <option value="Socially">Socially</option>
                  <option value="Regularly">Regularly</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Pet Preference</label>
                <select
                  value={pets}
                  onChange={(e) => setPets(e.target.value as PetOption)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm bg-white"
                >
                  <option value="No Pets">No Pets</option>
                  <option value="Pet Friendly">Pet Friendly</option>
                  <option value="Have a Pet">Have a Pet</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Food Preference</label>
                <select
                  value={foodPreference}
                  onChange={(e) => setFoodPreference(e.target.value as FoodOption)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm bg-white"
                >
                  <option value="Vegetarian">Vegetarian</option>
                  <option value="Eggetarian">Eggetarian</option>
                  <option value="Non-Vegetarian">Non-Vegetarian</option>
                  <option value="Vegan">Vegan</option>
                  <option value="Jain">Jain</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Sleep Schedule</label>
                <select
                  value={sleepSchedule}
                  onChange={(e) => setSleepSchedule(e.target.value as SleepOption)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm bg-white"
                >
                  <option value="Early Bird">Early Bird (Before 11 PM)</option>
                  <option value="Balanced">Balanced</option>
                  <option value="Night Owl">Night Owl (After 1 AM)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Work / Study Mode</label>
                <select
                  value={workMode}
                  onChange={(e) => setWorkMode(e.target.value as WorkModeOption)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm bg-white"
                >
                  <option value="Work From Office">Work From Office</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Work From Home">Work From Home</option>
                  <option value="Student">Student</option>
                </select>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Cleanliness</label>
                  <select
                    value={cleanliness}
                    onChange={(e) => setCleanliness(e.target.value as CleanlinessOption)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm bg-white"
                  >
                    <option value="Neat Freak">Neat Freak</option>
                    <option value="Moderately Clean">Moderately Clean</option>
                    <option value="Relaxed">Relaxed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Party Frequency</label>
                  <select
                    value={partyFrequency}
                    onChange={(e) => setPartyFrequency(e.target.value as PartyOption)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm bg-white"
                  >
                    <option value="Never">Never</option>
                    <option value="Occasionally">Occasionally</option>
                    <option value="Weekends">Weekends</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Guest Policy</label>
                  <select
                    value={guestPreference}
                    onChange={(e) => setGuestPreference(e.target.value as GuestOption)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm bg-white"
                  >
                    <option value="No Guests">No Guests</option>
                    <option value="Occasional Daytime">Occasional Daytime</option>
                    <option value="Overnight OK">Overnight OK</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  About Me (hobbies, routine, what makes you a great flatmate)
                </label>
                <textarea
                  rows={4}
                  maxLength={600}
                  value={aboutMe}
                  onChange={(e) => setAboutMe(e.target.value)}
                  placeholder="Love filter coffee, weekend badminton, keeping common areas tidy, and respecting quiet work hours..."
                  className="w-full p-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1 || saving}
              className="h-11 px-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-2 disabled:opacity-40"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            {step < 4 ? (
              <button
                type="button"
                onClick={() => {
                  if (validateStep()) setStep((s) => s + 1);
                }}
                className="h-11 px-5 rounded-xl bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold inline-flex items-center gap-2"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={saving}
                className="h-11 px-6 rounded-xl bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? 'Saving Profile...' : 'Complete & Start Matching'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
