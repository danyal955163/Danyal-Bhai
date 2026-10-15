import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import HomeRedirect from '@/components/HomeRedirect';
import PublicHomeContent from '@/components/Brand/PublicHomeContent';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/chat');

  return <><HomeRedirect /><PublicHomeContent /></>;
}
