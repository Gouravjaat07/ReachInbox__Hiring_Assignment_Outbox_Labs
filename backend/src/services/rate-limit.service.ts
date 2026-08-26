import { redis } from '../config/redis.js';
import { addHours, startOfUtcHour } from '../utils/time.js';

function utcHourKey(senderId: string, time: Date) {
  return `email-rate:${senderId}:${time.getUTCFullYear()}-${time.getUTCMonth() + 1}-${time.getUTCDate()}-${time.getUTCHours()}`;
}

function minDelayKey(senderId: string) {
  return `email-min-delay:${senderId}`;
}

const hourlyScript = `
  local current = tonumber(redis.call('GET', KEYS[1]) or '0')
  local limit = tonumber(ARGV[1])
  local expireAt = tonumber(ARGV[2])
  if current >= limit then
    return {0, expireAt}
  end
  local nextCount = redis.call('INCR', KEYS[1])
  if nextCount == 1 then
    redis.call('EXPIREAT', KEYS[1], math.floor(expireAt / 1000) + 60)
  end
  return {1, expireAt}
`;

const minDelayScript = `
  local nextAllowedAt = tonumber(redis.call('GET', KEYS[1]) or '0')
  local now = tonumber(ARGV[1])
  local minDelayMs = tonumber(ARGV[2])
  if nextAllowedAt > now then
    return {0, nextAllowedAt}
  end
  local availableAgainAt = now + minDelayMs
  redis.call('SET', KEYS[1], tostring(availableAgainAt), 'PX', math.max(minDelayMs * 2, 60000))
  return {1, availableAgainAt}
`;

const sendWindowScript = `
  local current = tonumber(redis.call('GET', KEYS[1]) or '0')
  local limit = tonumber(ARGV[1])
  local hourExpiresAt = tonumber(ARGV[2])
  local now = tonumber(ARGV[3])
  local minDelayMs = tonumber(ARGV[4])
  local nextAllowedAt = tonumber(redis.call('GET', KEYS[2]) or '0')

  if nextAllowedAt > now then
    return {0, nextAllowedAt}
  end
  if current >= limit then
    return {0, hourExpiresAt}
  end

  local nextCount = redis.call('INCR', KEYS[1])
  if nextCount == 1 then
    redis.call('EXPIREAT', KEYS[1], math.floor(hourExpiresAt / 1000) + 60)
  end
  local availableAgainAt = now + minDelayMs
  redis.call('SET', KEYS[2], tostring(availableAgainAt), 'PX', math.max(minDelayMs * 2, 60000))
  return {1, now}
`;

export async function reserveHourlySlot(senderId: string, limit: number, currentTime: Date) {
  const hourStart = startOfUtcHour(currentTime);
  const key = utcHourKey(senderId, hourStart);
  const nextHour = addHours(hourStart, 1).getTime();
  const result = (await redis.eval(hourlyScript, 1, key, String(limit), String(nextHour))) as [number, number];

  return {
    allowed: result[0] === 1,
    availableAt: new Date(result[1]),
  };
}

export async function reserveMinimumDelay(senderId: string, minDelayMs: number, currentTime: Date) {
  const key = minDelayKey(senderId);
  const result = (await redis.eval(minDelayScript, 1, key, String(currentTime.getTime()), String(minDelayMs))) as [number, number];

  return {
    allowed: result[0] === 1,
    availableAt: new Date(result[1]),
  };
}

export async function reserveSendWindow(senderId: string, hourlyLimit: number, minDelayMs: number, currentTime: Date) {
  const hourStart = startOfUtcHour(currentTime);
  const result = (await redis.eval(
    sendWindowScript,
    2,
    utcHourKey(senderId, hourStart),
    minDelayKey(senderId),
    String(hourlyLimit),
    String(addHours(hourStart, 1).getTime()),
    String(currentTime.getTime()),
    String(minDelayMs),
  )) as [number, number];

  return { allowed: result[0] === 1, availableAt: new Date(result[1]) };
}
