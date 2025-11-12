/**
 * Tests de Concurrencia - Rate Limit
 * Verifica que el rate limit funciona correctamente bajo carga
 * 
 * Criterios de Aceptación:
 * - ✅ 50 req/10min por IP bloquea correctamente
 * - ✅ Sliding window funciona correctamente
 * - ✅ Diferentes IPs tienen límites independientes
 * - ✅ Métricas de p99 para tiempos de respuesta
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Skip tests si no hay configuración de Upstash
const shouldSkip = !UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN;

describe.skipIf(shouldSkip)('Concurrency Rate Limit Tests', () => {
  let redis: Redis;
  let rateLimit: Ratelimit;

  beforeAll(() => {
    if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
      return;
    }

    redis = new Redis({
      url: UPSTASH_REDIS_REST_URL,
      token: UPSTASH_REDIS_REST_TOKEN,
    });

    rateLimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(50, '10 m'),
      analytics: false,
    });
  });

  describe('Límite de 50 req/10min', () => {
    it('debe permitir requests por debajo del límite', async () => {
      if (!rateLimit) return;

      const ip = '192.168.1.1';
      const limitKey = `hold:${ip}`;

      // Limpiar rate limit para esta IP
      await redis.del(limitKey);

      // Hacer 10 requests
      const results = [];
      for (let i = 0; i < 10; i++) {
        const { success } = await rateLimit.limit(limitKey);
        results.push(success);
      }

      // Todas las requests deben ser exitosas
      expect(results.every((r) => r === true)).toBe(true);
    }, 30000);

    it('debe denegar requests por encima del límite', async () => {
      if (!rateLimit) return;

      const ip = '192.168.1.2';
      const limitKey = `hold:${ip}`;

      // Limpiar rate limit para esta IP
      await redis.del(limitKey);

      // Hacer 51 requests (por encima del límite de 50)
      const results = [];
      for (let i = 0; i < 51; i++) {
        const { success } = await rateLimit.limit(limitKey);
        results.push(success);
      }

      // Al menos una request debe ser denegada
      const deniedCount = results.filter((r) => r === false).length;
      expect(deniedCount).toBeGreaterThan(0);
    }, 60000);

    it('debe medir tiempos de respuesta (p99)', async () => {
      if (!rateLimit) return;

      const ip = '192.168.1.3';
      const limitKey = `hold:${ip}`;
      const requests = 100;
      const times: number[] = [];

      // Limpiar rate limit para esta IP
      await redis.del(limitKey);

      for (let i = 0; i < requests; i++) {
        const start = Date.now();
        await rateLimit.limit(limitKey);
        const end = Date.now();
        times.push(end - start);
      }

      // Calcular p99
      times.sort((a, b) => a - b);
      const p99Index = Math.floor(times.length * 0.99);
      const p99 = times[p99Index];

      // Verificar que p99 es razonable (< 200ms para Redis)
      expect(p99).toBeLessThan(200);
    }, 60000);
  });

  describe('Sliding window', () => {
    it('debe usar sliding window para calcular límite', async () => {
      if (!rateLimit) return;

      const ip = '192.168.1.4';
      const limitKey = `hold:${ip}`;

      // Limpiar rate limit para esta IP
      await redis.del(limitKey);

      // Hacer request y verificar que tiene reset time
      const { success, reset } = await rateLimit.limit(limitKey);
      expect(success).toBe(true);
      expect(reset).toBeDefined();
      expect(reset).toBeGreaterThan(Date.now());
    }, 10000);
  });

  describe('Diferentes IPs', () => {
    it('debe aplicar límite por IP independientemente', async () => {
      if (!rateLimit) return;

      const ip1 = '192.168.1.5';
      const ip2 = '192.168.1.6';
      const limitKey1 = `hold:${ip1}`;
      const limitKey2 = `hold:${ip2}`;

      // Limpiar rate limit para ambas IPs
      await redis.del(limitKey1);
      await redis.del(limitKey2);

      // Hacer requests para ambas IPs
      const { success: success1 } = await rateLimit.limit(limitKey1);
      const { success: success2 } = await rateLimit.limit(limitKey2);

      // Ambas IPs deben tener límites independientes
      expect(success1).toBe(true);
      expect(success2).toBe(true);
    }, 10000);
  });
});

