import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, Loader2, ShieldCheck, X } from 'lucide-react';

interface PremiumBillingModalProps {
  isOpen: boolean;
  onClose: () => void;
  uid: string;
  userEmail: string;
  userName: string;
  userPhone?: string;
  initialPlan?: 'monthly' | 'quarterly' | 'annual' | 'featured_listing';
  listingId?: string;
  onPaymentVerified: (plan: string, expiresAt: string) => void;
}

interface CashfreeCheckoutResult {
  error?: { message?: string };
  redirect?: boolean;
  paymentDetails?: { paymentMessage?: string };
}

interface CashfreeInstance {
  checkout: (options: {
    paymentSessionId: string;
    redirectTarget?: '_modal' | '_self' | '_blank' | '_top';
  }) => Promise<CashfreeCheckoutResult>;
}

declare global {
  interface Window {
    Cashfree?: (config: { mode: 'sandbox' | 'production' }) => CashfreeInstance;
  }
}

const PLANS = [
  {
    id: 'monthly' as const,
    name: 'Monthly',
    price: 499,
    period: '/month',
    desc: 'Unlimited likes, Who Liked You, advanced filters',
  },
  {
    id: 'quarterly' as const,
    name: 'Quarterly',
    price: 1199,
    period: '/3 months',
    desc: 'Save 20% + 5 Super Likes & priority visibility',
  },
  {
    id: 'annual' as const,
    name: 'Annual',
    price: 3499,
    period: '/year',
    desc: 'Best value for frequent relocators & owners',
  },
];

function loadCashfreeScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Cashfree) {
      resolve(true);
      return;
    }
    const existing = document.querySelector('script[src="https://sdk.cashfree.com/js/v3/cashfree.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export const PremiumBillingModal: React.FC<PremiumBillingModalProps> = ({
  isOpen,
  onClose,
  uid,
  userEmail,
  userName,
  userPhone = '',
  initialPlan = 'quarterly',
  listingId,
  onPaymentVerified,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'quarterly' | 'annual' | 'featured_listing'>(initialPlan);
  const [phoneInput, setPhoneInput] = useState(userPhone.replace(/\D/g, '').slice(-10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingVars, setMissingVars] = useState<string[]>([]);

  useEffect(() => {
    setSelectedPlan(initialPlan);
  }, [initialPlan]);

  useEffect(() => {
    if (userPhone) {
      setPhoneInput(userPhone.replace(/\D/g, '').slice(-10));
    }
  }, [userPhone]);

  if (!isOpen) return null;

  const handleCheckout = async () => {
    const cleanPhone = phoneInput.replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setError('Enter a valid 10-digit Indian mobile number required by Cashfree.');
      return;
    }

    setLoading(true);
    setError(null);
    setMissingVars([]);

    try {
      const orderResp = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: selectedPlan,
          uid,
          listingId,
          customerName: userName,
          customerEmail: userEmail,
          customerPhone: cleanPhone,
        }),
      });
      const orderData = await orderResp.json();

      if (!orderResp.ok) {
        if (orderData.requiredEnv) {
          setMissingVars(orderData.requiredEnv);
        }
        setError(orderData.error || 'Unable to initiate Cashfree checkout.');
        setLoading(false);
        return;
      }

      const loaded = await loadCashfreeScript();
      if (!loaded || !window.Cashfree) {
        setError('Unable to load Cashfree Checkout SDK. Check your network connection.');
        setLoading(false);
        return;
      }

      const cashfree = window.Cashfree({
        mode: orderData.env === 'production' ? 'production' : 'sandbox',
      });

      const checkoutResult = await cashfree.checkout({
        paymentSessionId: orderData.paymentSessionId,
        redirectTarget: '_modal',
      });

      if (checkoutResult.error) {
        setError(checkoutResult.error.message || 'Cashfree checkout was cancelled or failed.');
        setLoading(false);
        return;
      }

      const verifyResp = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderData.orderId,
          plan: selectedPlan,
        }),
      });
      const verifyData = await verifyResp.json();

      if (verifyResp.ok && verifyData.verified) {
        onPaymentVerified(selectedPlan, verifyData.expiresAt);
        onClose();
      } else {
        setError(verifyData.error || 'Payment verification failed on server.');
      }
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment initiation error.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 space-y-5 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>

        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {selectedPlan === 'featured_listing'
              ? 'Feature Your Room Listing'
              : 'Upgrade to ROOMZY Plus'}
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Secure Indian payments powered by Cashfree (UPI, Cards, Netbanking).
          </p>
        </div>

        {selectedPlan === 'featured_listing' ? (
          <div className="p-5 rounded-2xl border-2 border-violet-700 bg-violet-50/40">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-slate-900">Featured Listing Boost</div>
                <div className="text-xs text-slate-600 mt-0.5">
                  Pin your room at the top of search results for 30 days
                </div>
              </div>
              <div className="text-2xl font-extrabold text-violet-700 font-mono-num">₹299</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PLANS.map((p) => {
              const active = selectedPlan === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPlan(p.id)}
                  className={`p-4 rounded-2xl border text-left transition-colors ${
                    active
                      ? 'border-2 border-violet-700 bg-violet-50/50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="text-xs font-semibold text-slate-600">{p.name}</div>
                  <div className="text-2xl font-extrabold text-slate-900 font-mono-num mt-1">
                    ₹{p.price}
                    <span className="text-xs font-normal text-slate-500">{p.period}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">{p.desc}</p>
                </button>
              );
            })}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Mobile Number for Cashfree Receipt & UPI
          </label>
          <div className="flex items-center gap-2">
            <span className="h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 flex items-center">
              +91
            </span>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="9876543210"
              className="flex-1 h-10 px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600"
            />
          </div>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
          <li className="flex items-center gap-2"><Check className="w-4 h-4 text-violet-700" /> Unlimited profile likes</li>
          <li className="flex items-center gap-2"><Check className="w-4 h-4 text-violet-700" /> See who liked your profile</li>
          <li className="flex items-center gap-2"><Check className="w-4 h-4 text-violet-700" /> Advanced lifestyle & food filters</li>
          <li className="flex items-center gap-2"><Check className="w-4 h-4 text-violet-700" /> Priority visibility in city search</li>
        </ul>

        {error && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs space-y-2">
            <div className="flex items-start gap-2 font-semibold">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
            {missingVars.length > 0 && (
              <div className="text-amber-900">
                Required server environment variables:{' '}
                <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-200">
                  {missingVars.join(', ')}
                </code>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <span className="text-xs text-slate-500 inline-flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Server-side Cashfree order verification
          </span>
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleCheckout()}
            className="h-11 px-6 rounded-xl bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Pay with Cashfree
          </button>
        </div>
      </div>
    </div>
  );
};
