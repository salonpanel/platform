import { redirect } from 'next/navigation'

export default function ConnectedPage() {
  // Redirect to payments config page
  redirect('/panel/config/payments')
}

export const runtime = 'edge'