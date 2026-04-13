import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/auth/webauthn/challenge
 * Generates a cryptographic challenge for WebAuthn registration or authentication.
 * The challenge is ephemeral (stored in a short-lived cookie for verification).
 */
export async function POST(request: NextRequest) {
  try {
    const { action, email } = await request.json();

    if (!action || !email) {
      return NextResponse.json({ error: 'Missing action or email' }, { status: 400 });
    }

    // Generate a cryptographically secure random challenge (32 bytes)
    const challengeBytes = new Uint8Array(32);
    crypto.getRandomValues(challengeBytes);
    const challenge = Buffer.from(challengeBytes).toString('base64url');

    const rpId = process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID || 
                 (process.env.NEXT_PUBLIC_SITE_URL 
                    ? new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname 
                    : 'localhost');
    const rpName = process.env.NEXT_PUBLIC_APP_NAME || 'SalonPanel';

    // Store challenge in a short-lived cookie (5 minutes)
    const response = NextResponse.json({
      challenge,
      rpId,
      rpName,
    });

    response.cookies.set('webauthn_challenge', challenge, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 300, // 5 minutes
      path: '/',
    });

    // Also store the email to verify it matches during authentication
    response.cookies.set('webauthn_email', email, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 300,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('[WebAuthn Challenge] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
