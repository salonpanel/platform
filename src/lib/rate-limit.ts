import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

let redis: Redis | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = Redis.fromEnv();
}

export const holdRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(50, "10 m"),
      analytics: false,
    })
  : null;

export function getClientIp(req: Request | Headers): string {
  let headers: Headers;
  
  if (req instanceof Request) {
    headers = req.headers;
  } else {
    headers = req;
  }
  
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const ips = forwarded.split(",").map((ip) => ip.trim());
    if (ips.length > 0 && ips[0]) {
      return ips[0];
    }
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

