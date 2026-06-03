'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSupabase } from '@/components/SupabaseProvider';
import { ArrowRight, BarChart3, Globe, Bell, FileText, Check } from 'lucide-react';

const features = [
  { icon: BarChart3, title: 'Competitor Intel', desc: 'Track competitor website changes, pricing updates, and new product launches automatically.' },
  { icon: Globe, title: 'Market Mapping', desc: 'Visual maps of your competitive landscape with positioning analysis and gap detection.' },
  { icon: Bell, title: 'Change Monitoring', desc: 'Real-time alerts when competitors update pages, change messaging, or launch campaigns.' },
  { icon: FileText, title: 'Sales Briefs', desc: 'Auto-generated battle cards and sales briefs from the latest competitive intelligence.' },
];

const plans = [
  { name: 'Free', price: '$0', credits: '100/mo', features: ['Basic monitoring', '1 competitor', 'Daily updates', 'Email alerts'] },
  { name: 'Starter', price: '$29', credits: '1,000/mo', features: ['Advanced monitoring', '5 competitors', 'Hourly updates', 'Slack alerts', 'API access'] },
  { name: 'Pro', price: '$99', credits: '10,000/mo', features: ['Full monitoring', '25 competitors', 'Real-time updates', 'All integrations', 'Sales briefs', 'Team access'] },
  { name: 'Scale', price: '$299', credits: '50,000/mo', features: ['Enterprise monitoring', 'Unlimited competitors', 'Real-time updates', 'Custom integrations', 'White-label reports', 'Dedicated support', 'SSO/SAML'] },
];

export default function Home() {
  const router = useRouter();
  const { user, isLoading } = useSupabase();

  useEffect(() => {
    if (!isLoading && user) router.replace('/dashboard');
  }, [user, isLoading, router]);

  if (isLoading) return null;
  if (user) return null;

  return (
    <main>
      <section className="max-w-6xl mx-auto px-4 pt-24 pb-16 text-center">
        <h1 className="text-5xl font-bold tracking-tight mb-4">WebIntel</h1>
        <p className="text-xl text-gray-500 mb-2">Autonomous Market Intelligence</p>
        <p className="text-gray-400 mb-8">AI-powered competitive monitoring and sales intelligence platform</p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
        >
          Get Started Free <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f) => (
            <div key={f.title} className="bg-white rounded-xl border p-6 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-gray-700" />
              </div>
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Simple, transparent pricing</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((p) => (
            <div key={p.name} className="bg-white rounded-xl border p-6 flex flex-col">
              <h3 className="text-lg font-semibold mb-1">{p.name}</h3>
              <div className="mb-4">
                <span className="text-3xl font-bold">{p.price}</span>
                <span className="text-gray-400 text-sm">/mo</span>
              </div>
              <p className="text-sm text-gray-500 mb-4">{p.credits}</p>
              <ul className="space-y-2 mb-6 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="text-sm flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className={`text-center py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  p.name === 'Pro'
                    ? 'bg-gray-900 text-white hover:bg-gray-800'
                    : 'border hover:bg-gray-50'
                }`}
              >
                {p.name === 'Free' ? 'Get Started' : 'Subscribe'}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold mb-4">Ready to get started?</h2>
        <p className="text-gray-500 mb-6">Join thousands of teams using WebIntel to stay ahead.</p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
        >
          Create Free Account <ArrowRight className="w-4 h-4" />
        </Link>
      </section>
    </main>
  );
}
