'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSupabase } from '@/components/SupabaseProvider';
import { ArrowRight, BarChart3, Globe, Bell, FileText, Check, Star, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useState } from 'react';

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

const testimonials = [
  { name: 'Sarah Chen', role: 'VP Marketing, TechCorp', content: 'WebIntel transformed how we track competitors. We caught a pricing change within minutes and adjusted our strategy immediately.' },
  { name: 'Marcus Rivera', role: 'Head of Sales, GrowthInc', content: 'The sales briefs alone save us hours every week. Our reps close deals faster because they always have the latest intel.' },
  { name: 'Emily Park', role: 'Product Manager, ScaleUp', content: 'Market mapping gave us clarity on where we actually compete. We found gaps we didn\'t know existed.' },
];

const stats = [
  { value: '10K+', label: 'Companies monitored' },
  { value: '99.9%', label: 'Uptime SLA' },
  { value: '2M+', label: 'Changes caught' },
  { value: '4.9/5', label: 'Customer rating' },
];

export default function Home() {
  const router = useRouter();
  const { user, isLoading } = useSupabase();
  const [testimonialIdx, setTestimonialIdx] = useState(0);

  useEffect(() => {
    if (!isLoading && user) router.replace('/dashboard');
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (user) return null;

  return (
    <main className="animate-fade-in">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/10 via-transparent to-brand-700/5" />
        <div className="max-w-6xl mx-auto px-4 pt-24 pb-16 text-center relative">
          <h1 className="text-5xl font-bold tracking-tight mb-4 bg-gradient-to-r from-gray-900 via-brand-700 to-gray-900 dark:from-white dark:via-brand-300 dark:to-white bg-clip-text text-transparent">
            WebIntel
          </h1>
          <p className="text-xl text-gray-500 dark:text-gray-400 mb-2">Autonomous Market Intelligence</p>
          <p className="text-gray-400 dark:text-gray-500 mb-8">AI-powered competitive monitoring and sales intelligence platform</p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-gray-900 dark:bg-white dark:text-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
          >
            Get Started Free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center animate-fade-in">
              <p className="text-3xl font-bold text-brand-600 dark:text-brand-400">{s.value}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12 dark:text-white">Everything you need to stay ahead</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f) => (
            <div key={f.title} className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-6 hover:shadow-md dark:hover:shadow-gray-900/50 transition-shadow">
              <div className="w-10 h-10 bg-brand-50 dark:bg-brand-900/30 rounded-lg flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              </div>
              <h3 className="font-semibold mb-2 dark:text-white">{f.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-gray-50 dark:bg-gray-900/50 py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 dark:text-white">Loved by teams worldwide</h2>
          <div className="relative max-w-2xl mx-auto">
            <div className="bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-xl p-8 text-center">
              <div className="flex justify-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-lg text-gray-700 dark:text-gray-300 mb-6 italic">&ldquo;{testimonials[testimonialIdx].content}&rdquo;</p>
              <p className="font-semibold dark:text-white">{testimonials[testimonialIdx].name}</p>
              <p className="text-sm text-gray-500">{testimonials[testimonialIdx].role}</p>
            </div>
            <button
              onClick={() => setTestimonialIdx(i => (i - 1 + testimonials.length) % testimonials.length)}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 w-10 h-10 bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-full flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              aria-label="Previous testimonial"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setTestimonialIdx(i => (i + 1) % testimonials.length)}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 w-10 h-10 bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-full flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              aria-label="Next testimonial"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12 dark:text-white">Simple, transparent pricing</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((p) => (
            <div key={p.name} className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-6 flex flex-col">
              <h3 className="text-lg font-semibold mb-1 dark:text-white">{p.name}</h3>
              <div className="mb-4">
                <span className="text-3xl font-bold dark:text-white">{p.price}</span>
                <span className="text-gray-400 text-sm">/mo</span>
              </div>
              <p className="text-sm text-gray-500 mb-4">{p.credits}</p>
              <ul className="space-y-2 mb-6 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="text-sm flex items-start gap-2 text-gray-600 dark:text-gray-400">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className={`text-center py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  p.name === 'Pro'
                    ? 'bg-gray-900 dark:bg-white dark:text-gray-900 text-white hover:bg-gray-800 dark:hover:bg-gray-100'
                    : 'border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-gray-300'
                }`}
              >
                {p.name === 'Free' ? 'Get Started' : 'Subscribe'}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold mb-4 dark:text-white">Ready to get started?</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">Join thousands of teams using WebIntel to stay ahead.</p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 bg-gray-900 dark:bg-white dark:text-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
        >
          Create Free Account <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      <footer className="border-t dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h4 className="font-bold mb-4 dark:text-white">WebIntel</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">Autonomous market intelligence for modern teams.</p>
            </div>
            <div>
              <h5 className="font-semibold text-sm mb-3 dark:text-gray-300">Product</h5>
              <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                <li><Link href="/#features" className="hover:text-gray-900 dark:hover:text-white transition-colors">Features</Link></li>
                <li><Link href="/#pricing" className="hover:text-gray-900 dark:hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="/#api" className="hover:text-gray-900 dark:hover:text-white transition-colors">API</Link></li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold text-sm mb-3 dark:text-gray-300">Company</h5>
              <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                <li><Link href="/#" className="hover:text-gray-900 dark:hover:text-white transition-colors">About</Link></li>
                <li><Link href="/#" className="hover:text-gray-900 dark:hover:text-white transition-colors">Blog</Link></li>
                <li><Link href="/#" className="hover:text-gray-900 dark:hover:text-white transition-colors">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold text-sm mb-3 dark:text-gray-300">Legal</h5>
              <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                <li><Link href="/#" className="hover:text-gray-900 dark:hover:text-white transition-colors">Privacy</Link></li>
                <li><Link href="/#" className="hover:text-gray-900 dark:hover:text-white transition-colors">Terms</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t dark:border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400 dark:text-gray-500">
            &copy; {new Date().getFullYear()} WebIntel. All rights reserved.
          </div>
        </div>
      </footer>
    </main>
  );
}
