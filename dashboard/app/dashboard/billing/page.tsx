'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/components/SupabaseProvider';
import CreditsGauge from '@/components/CreditsGauge';
import { Check, Sparkles } from 'lucide-react';

const plans = [
  { name: 'Free', price: '$0', credits: '100/mo', popular: false, features: ['Basic monitoring', '1 competitor', 'Daily updates', 'Email alerts', '7-day history'] },
  { name: 'Starter', price: '$29', credits: '1,000/mo', popular: false, features: ['Advanced monitoring', '5 competitors', 'Hourly updates', 'Slack alerts', 'API access', '30-day history'] },
  { name: 'Pro', price: '$99', credits: '10,000/mo', popular: true, features: ['Full monitoring', '25 competitors', 'Real-time updates', 'All integrations', 'Sales briefs', 'Team access (5 seats)', '90-day history'] },
  { name: 'Scale', price: '$299', credits: '50,000/mo', popular: false, features: ['Enterprise monitoring', 'Unlimited competitors', 'Real-time updates', 'Custom integrations', 'White-label reports', 'Dedicated support', 'SSO/SAML', 'Unlimited history'] },
];

export default function BillingPage() {
  const router = useRouter();
  const { user, isLoading, credits } = useSupabase();

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [user, isLoading, router]);

  if (isLoading || !user) return null;

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Billing & Plan</h1>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border p-5">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Current Plan</span>
          <p className="text-2xl font-bold mt-1">Starter</p>
          <p className="text-sm text-gray-500">$29/month</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Credits Used</span>
          <p className="text-2xl font-bold mt-1">{credits.total - credits.remaining}</p>
          <p className="text-sm text-gray-500">of {credits.total} this cycle</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <CreditsGauge used={credits.total - credits.remaining} total={credits.total} size={80} />
        </div>
      </div>

      <h2 className="text-lg font-bold mb-4">Compare Plans</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`bg-white rounded-xl border p-5 flex flex-col relative ${
              plan.popular ? 'ring-2 ring-gray-900' : ''
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs font-medium px-3 py-1 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Most Popular
              </div>
            )}
            <h3 className="font-semibold text-lg mb-1">{plan.name}</h3>
            <div className="mb-3">
              <span className="text-3xl font-bold">{plan.price}</span>
              <span className="text-gray-400 text-sm">/mo</span>
            </div>
            <p className="text-sm text-gray-500 mb-4">{plan.credits}</p>
            <ul className="space-y-2 mb-6 flex-1">
              {plan.features.map((f) => (
                <li key={f} className="text-sm flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                plan.name === 'Free'
                  ? 'border text-gray-600 cursor-not-allowed opacity-50'
                  : plan.popular
                  ? 'bg-gray-900 text-white hover:bg-gray-800'
                  : 'border hover:bg-gray-50'
              }`}
              disabled={plan.name === 'Free'}
              title={plan.name !== 'Free' ? 'Coming soon' : undefined}
            >
              {plan.name === 'Free' ? 'Current' : 'Upgrade — Coming Soon'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
