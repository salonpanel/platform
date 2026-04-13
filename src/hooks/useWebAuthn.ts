'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'webauthn_credential_id';
const EMAIL_STORAGE_KEY = 'webauthn_email';

/**
 * Converts a base64url string to an ArrayBuffer
 */
function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
  const binary = atob(padded);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i);
  }
  return buffer;
}

/**
 * Converts an ArrayBuffer to a base64url string
 */
function bufferToBase64url(buffer: ArrayBuffer): string {
  const view = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < view.byteLength; i++) {
    binary += String.fromCharCode(view[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export type WebAuthnStatus = 'idle' | 'registering' | 'authenticating' | 'success' | 'error';

export function useWebAuthn() {
  const [isSupported, setIsSupported] = useState(false);
  const [hasCredential, setHasCredential] = useState(false);
  const [status, setStatus] = useState<WebAuthnStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if WebAuthn is supported (Safari iOS 16+, Chrome 67+)
    const supported =
      typeof window !== 'undefined' &&
      !!window.PublicKeyCredential &&
      typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function';

    if (supported) {
      window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then((available) => {
          setIsSupported(available);
          // Check if we have a stored credential for this device
          const storedId = localStorage.getItem(STORAGE_KEY);
          setHasCredential(!!storedId);
        })
        .catch(() => setIsSupported(false));
    }
  }, []);

  /**
   * Register a new Face ID / Touch ID credential after successful OTP login
   */
  async function register(email: string, userId: string): Promise<boolean> {
    setStatus('registering');
    setError(null);

    try {
      // 1. Get challenge from server
      const challengeRes = await fetch('/api/auth/webauthn/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'register', email }),
      });

      if (!challengeRes.ok) {
        throw new Error('No se pudo obtener el desafío del servidor');
      }

      const { challenge, rpId, rpName } = await challengeRes.json();

      // 2. Create credential using platform authenticator (Face ID / Touch ID)
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: base64urlToBuffer(challenge),
          rp: { id: rpId, name: rpName },
          user: {
            id: base64urlToBuffer(bufferToBase64url(new TextEncoder().encode(userId).buffer as ArrayBuffer)),
            name: email,
            displayName: email,
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },  // ES256
            { alg: -257, type: 'public-key' }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform', // Only Face ID / Touch ID
            userVerification: 'required',
            residentKey: 'preferred',
          },
          timeout: 60000,
          attestation: 'none',
        },
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error('No se pudo crear la credencial');
      }

      const response = credential.response as AuthenticatorAttestationResponse;

      // 3. Send credential to server for storage
      const registerRes = await fetch('/api/auth/webauthn/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          credentialId: bufferToBase64url(credential.rawId),
          clientDataJSON: bufferToBase64url(response.clientDataJSON),
          attestationObject: bufferToBase64url(response.attestationObject),
          email,
        }),
      });

      if (!registerRes.ok) {
        const data = await registerRes.json();
        throw new Error(data.error || 'Error al registrar la credencial');
      }

      // 4. Save credential ID and email locally
      localStorage.setItem(STORAGE_KEY, bufferToBase64url(credential.rawId));
      localStorage.setItem(EMAIL_STORAGE_KEY, email);
      setHasCredential(true);
      setStatus('success');
      return true;
    } catch (err: any) {
      // User cancelled or device doesn't support
      if (err?.name === 'NotAllowedError') {
        setStatus('idle');
        return false;
      }
      console.error('[WebAuthn] Registration error:', err);
      setError(err?.message || 'Error al configurar Face ID');
      setStatus('error');
      return false;
    }
  }

  /**
   * Authenticate using Face ID / Touch ID
   * Returns the email if successful (to pass to the session creation)
   */
  async function authenticate(): Promise<{ email: string } | null> {
    setStatus('authenticating');
    setError(null);

    try {
      const storedCredentialId = localStorage.getItem(STORAGE_KEY);
      const storedEmail = localStorage.getItem(EMAIL_STORAGE_KEY);

      if (!storedCredentialId || !storedEmail) {
        throw new Error('No hay credencial guardada en este dispositivo');
      }

      // 1. Get challenge from server
      const challengeRes = await fetch('/api/auth/webauthn/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'authenticate', email: storedEmail }),
      });

      if (!challengeRes.ok) {
        throw new Error('No se pudo obtener el desafío del servidor');
      }

      const { challenge, rpId } = await challengeRes.json();

      // 2. Get assertion using platform authenticator
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: base64urlToBuffer(challenge),
          rpId,
          allowCredentials: [
            {
              id: base64urlToBuffer(storedCredentialId),
              type: 'public-key',
              transports: ['internal'],
            },
          ],
          userVerification: 'required',
          timeout: 60000,
        },
      }) as PublicKeyCredential;

      if (!assertion) {
        throw new Error('Autenticación cancelada');
      }

      const response = assertion.response as AuthenticatorAssertionResponse;

      // 3. Verify assertion on server and get session
      const verifyRes = await fetch('/api/auth/webauthn/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          credentialId: bufferToBase64url(assertion.rawId),
          clientDataJSON: bufferToBase64url(response.clientDataJSON),
          authenticatorData: bufferToBase64url(response.authenticatorData),
          signature: bufferToBase64url(response.signature),
          email: storedEmail,
        }),
      });

      if (!verifyRes.ok) {
        const data = await verifyRes.json();
        throw new Error(data.error || 'Error al verificar Face ID');
      }

      setStatus('success');
      return { email: storedEmail };
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        setStatus('idle');
        return null;
      }
      console.error('[WebAuthn] Authentication error:', err);
      setError(err?.message || 'Error al autenticar con Face ID');
      setStatus('error');
      return null;
    }
  }

  /**
   * Remove stored credential (logout from device)
   */
  function clearCredential() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(EMAIL_STORAGE_KEY);
    setHasCredential(false);
  }

  function getStoredEmail(): string | null {
    return localStorage.getItem(EMAIL_STORAGE_KEY);
  }

  return {
    isSupported,
    hasCredential,
    status,
    error,
    register,
    authenticate,
    clearCredential,
    getStoredEmail,
  };
}
