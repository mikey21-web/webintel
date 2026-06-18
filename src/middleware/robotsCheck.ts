import { FastifyRequest, FastifyReply } from 'fastify';
import { checkRobotsTxt, RobotsCheckResult } from '../scraping/robots';

declare module 'fastify' {
  interface FastifyRequest {
    robotsCheck?: RobotsCheckResult;
  }
}

export function requireRobotsPermission() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { url?: string; domain?: string; ignoreRobots?: boolean };
    const url = body?.url || body?.domain;

    if (body?.ignoreRobots === true) return;

    if (url && typeof url === 'string') {
      const result = await checkRobotsTxt(url);
      if (!result.allowed) {
        return reply.status(403).send({
          error: 'Robots.txt restriction',
          message: result.reason,
          domain: result.domain,
          robotsUrl: `https://${result.domain}/robots.txt`,
          hint: 'Pass ignoreRobots: true to override (use responsibly)',
        });
      }
      request.robotsCheck = result;
    }
  };
}

export async function checkUrlRobots(url: string): Promise<boolean> {
  const result = await checkRobotsTxt(url);
  return result.allowed;
}
