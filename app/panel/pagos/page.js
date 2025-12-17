import { redirect } from 'next/navigation'

export default function PagosPage() {
  // Redirect to payments config page
  redirect('/panel/config/payments')
}

export const runtime = 'edge'
