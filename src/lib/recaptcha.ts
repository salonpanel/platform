export async function verifyRecaptcha(token: string, remoteIp?: string) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    return { success: true, score: 1 };
  }

  if (!token) {
    return { success: false, score: 0 };
  }

  const params = new URLSearchParams();
  params.append("secret", secret);
  params.append("response", token);
  if (remoteIp) {
    params.append("remoteip", remoteIp);
  }

  const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    return { success: false, score: 0 };
  }

  const data = (await res.json()) as {
    success: boolean;
    score?: number;
  };

  return {
    success: data.success,
    score: data.score ?? 0,
  };
}

