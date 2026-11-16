import type { Metadata } from 'next';
import { ProfileView } from '@/features/profile/profile-view';

export const metadata: Metadata = { title: 'Perfil', robots: { index: false } };

export default function ProfilePage() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">Perfil</h1>
      <ProfileView />
    </main>
  );
}
