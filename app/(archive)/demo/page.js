import { redirect } from 'next/navigation';

export const metadata = {
  title: 'DashClaw Live Demo',
  description: 'Live demo of the DashClaw dashboard (read-only, fake data).',
};

export default function DemoPage() {
  // The demo is the real dashboard UI, powered by fixture-backed /api/* responses in demo mode.
  redirect('/mission-control');
}
