import { redirect } from 'next/navigation';

// The dashboards live at /portal (served with the signed-in user injected).
export default function Home() {
  redirect('/portal');
}
