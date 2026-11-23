import React, { useState } from 'react';
import { ArrowRight, Check, ChevronDown, ShieldCheck } from 'lucide-react';
import { INDIAN_CITIES } from '../types/roomzy';

interface LandingPageProps {
  onOpenAuth: (mode: 'signin' | 'signup') => void;
  onExploreRoomsPublic: () => void;
}

const FAQ_ITEMS = [
  {
    q: 'How does ROOMZY calculate lifestyle compatibility?',
    a: 'ROOMZY evaluates nine practical living dimensions including monthly rental budget, preferred locality, sleep schedule, cleanliness standards, food preferences, smoking/drinking habits, work-from-home vs. office hours, pet policies, and guest frequency.',
  },
  {
    q: 'Are Aadhaar or PAN documents ever shown publicly?',
    a: 'Never. Government ID verification is handled privately through compliant KYC masking. Only a verified badge is displayed on your profile after verification succeeds — raw document numbers are never stored or shared.',
  },
  {
    q: 'Can flat owners list spare rooms without paying a brokerage?',
    a: 'Yes. Flat owners and existing tenants searching for a replacement flatmate can publish basic room listings for free and chat directly with verified prospects.',
  },
  {
    q: 'How do payments and subscriptions work in India?',
    a: 'All ROOMZY Plus plans (Monthly, Quarterly, Annual) and Featured Listing boosts support UPI, cards, and netbanking via Cashfree with server-side order verification.',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenAuth,
  onExploreRoomsPublic,
}) => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="text-xl font-extrabold tracking-tight text-slate-900 font-display whitespace-nowrap shrink-0"
          >
            ROOMZY
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a href="#how-it-works" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              How It Works
            </a>
            <a href="#matching" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              Compatibility
            </a>
            <a href="#rooms" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              Available Rooms
            </a>
            <a href="#membership" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              Membership
            </a>
            <a href="#faq" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => onOpenAuth('signin')}
              className="px-4 py-2 text-sm font-semibold text-white bg-violet-700 rounded-xl hover:bg-violet-800 transition-colors whitespace-nowrap shrink-0"
            >
              Find My Flatmate
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="top" className="max-w-7xl mx-auto px-6 pt-12 pb-16 lg:pt-16 lg:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center">
            <p className="text-xs font-semibold text-violet-700 tracking-wide mb-3">
              Find Your Space. Match Your Vibe.
            </p>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.1] [text-wrap:balance]">
              Your Next Flatmate Is Just One Match Away.
            </h1>
            <p className="mt-5 text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
              Stop scrolling through endless WhatsApp groups. Find people who match your lifestyle, budget and location.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <button
                onClick={() => onOpenAuth('signup')}
                className="h-12 px-6 rounded-xl bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
              >
                Find My Flatmate
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={onExploreRoomsPublic}
                className="h-12 px-6 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                Explore Rooms
              </button>
            </div>

            <div className="mt-10 pt-6 border-t border-slate-200 text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1.5">
              {INDIAN_CITIES.map((city, idx) => (
                <React.Fragment key={city.name}>
                  <span className="font-medium text-slate-700">{city.name}</span>
                  {idx < INDIAN_CITIES.length - 1 && <span aria-hidden="true">·</span>}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 h-72 sm:h-96 lg:h-full min-h-[340px]">
              <img
                src="/src/assets/images/hero_indian_apartment_1795424077151.jpg"
                alt="Sunlit shared apartment living room in Bangalore"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/15 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 text-white">
                <p className="text-xs font-medium text-white/80">
                  Indiranagar, Bangalore · Verified Shared Homes
                </p>
                <p className="text-base font-bold mt-0.5">
                  Lifestyle-scored flatmates & direct owner listings across 10 Indian cities
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-slate-50 border-y border-slate-200 py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">How It Works</h2>
            <p className="mt-2 text-slate-600">
              Built for relocating IT engineers, students, and working professionals moving across India.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <div className="text-sm font-bold text-violet-700 font-mono-num mb-3">01. Profile & Preferences</div>
              <h3 className="text-lg font-bold text-slate-900">Share how you actually live</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Set your budget in INR, target localities, sleep rhythm, dietary habits, WFH schedule, and cleanliness standards in under two minutes.
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <div className="text-sm font-bold text-violet-700 font-mono-num mb-3">02. Compatibility Swipe</div>
              <h3 className="text-lg font-bold text-slate-900">Match with aligned flatmates</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Swipe through ranked profiles displaying transparent compatibility percentages before ever sharing your phone number.
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <div className="text-sm font-bold text-violet-700 font-mono-num mb-3">03. Chat & Move In</div>
              <h3 className="text-lg font-bold text-slate-900">Tour rooms without brokers</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Unlock real-time 1:1 messaging on mutual matches or inquire directly on verified shared rooms with zero brokerage surprises.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Find Your Perfect Match */}
      <section id="matching" className="max-w-7xl mx-auto px-6 py-16 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
              Find Your Perfect Match Before Signing a 11-Month Lease
            </h2>
            <p className="mt-4 text-slate-600 leading-relaxed">
              Most flatmate conflicts happen over unstated habits — late-night calls, kitchen rules, guests, and AC cleaning. ROOMZY scores every candidate across your real preferences so you know where you align before you meet.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-slate-700">
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-violet-700 shrink-0" />
                <span>Budget tolerance & locality overlap weighted automatically</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-violet-700 shrink-0" />
                <span>Vegetarian, Eggetarian, Jain, Vegan & Non-Veg kitchen filters</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-violet-700 shrink-0" />
                <span>WFH vs. office schedule & sleep-hour alignment</span>
              </li>
            </ul>
            <button
              onClick={() => onOpenAuth('signup')}
              className="mt-8 h-11 px-5 rounded-xl bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold inline-flex items-center gap-2"
            >
              Calculate Your Compatibility
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="lg:col-span-6">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div>
                  <div className="text-sm font-bold text-slate-900">Sample Compatibility Breakdown</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Indiranagar, Bangalore · ₹18,000/mo · Private Room
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-extrabold text-violet-700 font-mono-num">92%</div>
                  <div className="text-xs text-slate-500">Lifestyle Match</div>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                {[
                  { label: 'Budget & Locality Overlap', value: '36 / 38 pts' },
                  { label: 'Sleep & WFH Rhythm', value: '18 / 18 pts' },
                  { label: 'Cleanliness & Kitchen Habits', value: '22 / 22 pts' },
                  { label: 'Smoking, Drinking & Guests', value: '16 / 22 pts' },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between py-2 border-b border-slate-200/70 last:border-0">
                    <span className="text-slate-700">{row.label}</span>
                    <span className="font-mono-num font-semibold text-slate-900">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Discover Available Rooms */}
      <section id="rooms" className="bg-slate-50 border-y border-slate-200 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">Discover Available Rooms</h2>
              <p className="mt-2 text-slate-600">
                Browse furnished private rooms and shared 2BHK/3BHK apartments posted directly by flatmates and owners.
              </p>
            </div>
            <button
              onClick={onExploreRoomsPublic}
              className="h-11 px-5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-sm font-semibold text-slate-900 whitespace-nowrap shrink-0"
            >
              Browse Marketplace
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="aspect-[4/3] bg-slate-100">
                <img
                  src="/src/assets/images/room_master_bedroom_1795424076459.jpg"
                  alt="Furnished private master bedroom with study desk"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6">
                <div className="text-xs text-slate-500">
                  Private Rooms · Study-Ready · Attached Bath
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-1">
                  Transparent Rent, Deposit & Maintenance Breakdown
                </h3>
                <p className="text-sm text-slate-600 mt-2">
                  Every listing separates monthly rent, security deposit, and society maintenance charges upfront before you message.
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="aspect-[4/3] bg-slate-100">
                <img
                  src="/src/assets/images/room_shared_lounge_1795424075685.jpg"
                  alt="Modern 3BHK shared flat living and dining area"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6">
                <div className="text-xs text-slate-500">
                  Shared 2BHK & 3BHK Flats · Interactive Map
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-1">
                  Filter by Commute Hub, Furnishing & Preferences
                </h3>
                <p className="text-sm text-slate-600 mt-2">
                  Pinpoint flats near tech parks and metro stations across Koramangala, Bandra, Baner, Cyber City, and HITEC City.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Verified Community */}
      <section className="max-w-7xl mx-auto px-6 py-16 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6">
            <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
              <img
                src="/src/assets/images/community_flatmates_balcony_1795424076519.jpg"
                alt="Flatmates enjoying coffee on an apartment balcony"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          <div className="lg:col-span-6">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-violet-700 mb-3">
              <ShieldCheck className="w-4 h-4" />
              Verified Community & Safety Controls
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
              Safety Built Into Every Match & Message
            </h2>
            <p className="mt-4 text-slate-600 leading-relaxed">
              Your phone number and email remain private. Users can complete optional phone, email, and compliant KYC identity verification to earn a Verified Badge, with strict privacy protections ensuring Aadhaar or PAN details are never exposed.
            </p>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="font-semibold text-slate-900">Masked KYC Privacy</div>
                <div className="text-slate-600 text-xs mt-1">
                  Only verification status is shown; identity documents stay private.
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="font-semibold text-slate-900">1-Tap Block & Report</div>
                <div className="text-slate-600 text-xs mt-1">
                  Moderation team reviews reported accounts and suspicious listings.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Premium Membership */}
      <section id="membership" className="bg-slate-50 border-y border-slate-200 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Transparent Indian Pricing</h2>
            <p className="mt-2 text-slate-600">
              Start free to create your profile, match, and chat. Upgrade to ROOMZY Plus when you want unlimited likes and instant visibility.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-500">Free Plan</div>
                <div className="text-3xl font-extrabold text-slate-900 font-mono-num mt-2">₹0</div>
                <p className="text-xs text-slate-500 mt-1">Forever free for essential discovery</p>
                <ul className="mt-6 space-y-2.5 text-sm text-slate-700">
                  <li>Create flatmate profile & post 1 room</li>
                  <li>10 daily profile likes</li>
                  <li>Match & real-time 1:1 chat</li>
                  <li>Basic city & budget filters</li>
                </ul>
              </div>
              <button
                onClick={() => onOpenAuth('signup')}
                className="mt-8 w-full h-11 rounded-xl border border-slate-200 hover:bg-slate-50 text-sm font-semibold text-slate-900"
              >
                Get Started Free
              </button>
            </div>

            <div className="bg-white border-2 border-violet-700 rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <div className="text-sm font-semibold text-violet-700">ROOMZY Plus · Quarterly</div>
                <div className="text-3xl font-extrabold text-slate-900 font-mono-num mt-2">
                  ₹1,199 <span className="text-sm font-normal text-slate-500">/ 3 months</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Or ₹499/mo · ₹3,499/yr via Cashfree</p>
                <ul className="mt-6 space-y-2.5 text-sm text-slate-700">
                  <li>Unlimited daily likes & 5 Super Likes/month</li>
                  <li>See everyone who liked your profile</li>
                  <li>Advanced food, sleep & WFH filters</li>
                  <li>Priority profile placement in your city</li>
                </ul>
              </div>
              <button
                onClick={() => onOpenAuth('signup')}
                className="mt-8 w-full h-11 rounded-xl bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold"
              >
                Join ROOMZY Plus
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-500">Property Owners</div>
                <div className="text-3xl font-extrabold text-slate-900 font-mono-num mt-2">
                  ₹299 <span className="text-sm font-normal text-slate-500">/ boost</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Free basic listing · Paid featured placement</p>
                <ul className="mt-6 space-y-2.5 text-sm text-slate-700">
                  <li>Unlimited free basic room listings</li>
                  <li>Top-of-search Featured Boost for 30 days</li>
                  <li>Verified tenant preference screening</li>
                  <li>Direct in-app inquiries with prospects</li>
                </ul>
              </div>
              <button
                onClick={() => onOpenAuth('signup')}
                className="mt-8 w-full h-11 rounded-xl border border-slate-200 hover:bg-slate-50 text-sm font-semibold text-slate-900"
              >
                List Your Room
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="max-w-4xl mx-auto px-6 py-16 lg:py-24">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-8">Frequently Asked Questions</h2>
        <div className="divide-y divide-slate-200 border-y border-slate-200">
          {FAQ_ITEMS.map((item, index) => (
            <div key={item.q} className="py-4">
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                className="w-full flex items-center justify-between text-left py-2 gap-4"
              >
                <span className="text-base font-semibold text-slate-900">{item.q}</span>
                <ChevronDown
                  className={`w-5 h-5 text-slate-500 shrink-0 transition-transform ${
                    openFaq === index ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {openFaq === index && (
                <p className="text-sm text-slate-600 leading-relaxed pt-2 pb-1">{item.a}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 py-10 bg-white">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="font-bold text-slate-900 text-sm font-display">ROOMZY</div>
          <div>Find Your Space. Match Your Vibe. · India Flatmate & Shared Housing Platform</div>
          <div>© {new Date().getFullYear()} ROOMZY Technologies</div>
        </div>
      </footer>
    </div>
  );
};
