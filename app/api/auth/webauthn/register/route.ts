import { NextRequest, NextResponse } from 'next/server';
import { createClientForServer } from '@/lib/supabase/server-client';

/**
 * POST /api/auth/webauthn/register
 * Stores a WebAuthn credential (public key) for a user after successful Face ID registration.
 * Only callable when the user already has a valid session (they just logged in via OTP).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClientForServer();

    // Verify the user is authenticated (they just logged in via OTP)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { credentialId, clientDataJSON, attestationObject, email } = await request.json();

    if (!credentialId || !clientDataJSON || !attestationObject || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify the challenge cookie matches
    const storedChallenge = request.cookies.get('webauthn_challenge')?.value;
    const storedEmail = request.cookies.get('webauthn_email')?.value;

    if (!storedChallenge) {
      return NextResponse.json({ error: 'Challenge expired or missing' }, { status: 400 });
    }

    if (storedEmail !== email || user.email !== email) {
      return NextResponse.json({ error: 'Email mismatch' }, { status: 400 });
    }

    // Verify clientDataJSON contains the expected challenge
    const clientData = JSON.parse(Buffer.from(clientDataJSON, 'base64url').toString('utf-8'));
    if (clientData.challenge !== storedChallenge) {
      return NextResponse.json({ error: 'Challenge mismatch' }, { status: 400 });
    }

    if (clientData.type !== 'webauthn.create') {
      return NextResponse.json({ error: 'Invalid operation type' }, { status: 400 });
    }

    // Store credential in Supabase
    // Upsert: if user already has a credential on this device, update it
    const { error: dbError } = await supabase
      .from('webauthn_credentials')
      .upsert(
        {
          user_id: user.id,
          credential_id: credentialId,
          public_key: attestationObject, // Store raw attestation for now
        },
        { onConflict: 'credential_id' }
      );

    if (dbError) {
      console.error('[WebAuthn Register] DB Error:', dbError);
      return NextResponse.json({ error: 'Failed to save credential' }, { status: 500 });
    }

    // Clear the challenge cookie
    const response = NextResponse.json({ ok: true });
    response.cookies.delete('webauthn_challenge');
    response.cookies.delete('webauthn_email');

    return response;
  } catch (error) {
    console.error('[WebAuthn Register] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
