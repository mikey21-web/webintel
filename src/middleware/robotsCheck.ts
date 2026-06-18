import { FastifyRequest, FastifyReply } from 'fastify';
import { checkRobotsTxt, RobotsCheckResult } from '../scraping/robots';

declare module 'fastify' {
  interface FastifyRequest {
    robotsCheck?: RobotsCheckResult;
  }
}

export function requireRobotsPermission() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Only check POST/PUT/PATCH requests with a URL body
    const body = request.body as { url?: string; domain?: string };
    const url = body?.url || body?.domain;
    
    if (url && typeof url === 'string') {
      const result = await checkRobotsTxt(url);
      if (!result.allowed) {
        return reply.status(403).send({
          error: 'Robots.txt restriction',
          message: result.reason,
          domain: result.domain,
          robotsUrl: `https://${result.domain}/robots.txt`,
        });
      }
      // Store for downstream use
      request.robotsCheck = result;
    }
  };
}

export async function checkUrlRobots(url: string): Promise<boolean> {
  const result = await checkRobotsTxt(url);
  return result.allowed;
}
