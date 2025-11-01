import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect to login page by default
  redirect('/login');
  
  return null; // This won't be rendered due to the redirect
}
