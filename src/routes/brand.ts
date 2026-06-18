import { FastifyInstance } from 'fastify';
import { resolveBrand } from '../brand/resolver';
import { buildWhatsAppTheme } from '../brand/whatsapp';
import { requireAuth } from '../middleware/auth';
import { askAI } from '../ai';

async function brandHandler(domain: string, handler: (brand: any) => any) {
  if (!domain) {
    const err = new Error('domain query parameter is required');
    (err as any).statusCode = 400;
    throw err;
  }
  const brand = await resolveBrand(domain);
  if (!brand) {
    const err = new Error('Brand not found');
    (err as any).statusCode = 404;
    throw err;
  }
  return handler(brand);
}

export async function brandRoutes(app: FastifyInstance) {
  app.get('/profile', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const { domain } = req.query as { domain: string };
      return await brandHandler(domain, (brand) => ({
        domain: brand.domain, brandName: brand.description, logoUrl: brand.logoUrl,
        description: brand.description, industry: brand.industry, data: brand,
      }));
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: err.message });
    }
  });

  app.get('/logo', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const { domain } = req.query as { domain: string };
      return await brandHandler(domain, (brand) => ({
        domain: brand.domain, logoUrl: brand.logoUrl, details: brand.logoVariants || null,
      }));
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: err.message });
    }
  });

  app.get('/colors', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const { domain } = req.query as { domain: string };
      return await brandHandler(domain, (brand) => ({
        domain: brand.domain, primary: brand.primaryColor, palette: brand.palette || [],
      }));
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: err.message });
    }
  });

  app.get('/fonts', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const { domain } = req.query as { domain: string };
      return await brandHandler(domain, (brand) => ({
        domain: brand.domain, fonts: brand.fonts || [],
      }));
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: err.message });
    }
  });

  app.get('/styleguide', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const { domain } = req.query as { domain: string };
      return await brandHandler(domain, (brand) => ({
        domain: brand.domain, primary: brand.primaryColor, palette: brand.palette || [],
        styleguide: brand.styleguide || {},
      }));
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: err.message });
    }
  });

  app.get('/socials', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const { domain } = req.query as { domain: string };
      return await brandHandler(domain, (brand) => ({
        domain: brand.domain, socials: brand.socials || {},
      }));
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: err.message });
    }
  });

  app.get('/address', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const { domain } = req.query as { domain: string };
      return await brandHandler(domain, (brand) => ({
        domain: brand.domain, address: brand.address || null,
        city: brand.city || null, state: brand.state || null, pincode: brand.pincode || null,
      }));
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: err.message });
    }
  });

  app.get('/techstack', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const { domain } = req.query as { domain: string };
      return await brandHandler(domain, (brand) => ({
        domain: brand.domain, techstack: brand.techStack || [],
      }));
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: err.message });
    }
  });

  app.get('/whatsapp-theme', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const { domain } = req.query as { domain: string };
      return await brandHandler(domain, (brand) => ({
        domain: brand.domain, theme: buildWhatsAppTheme(brand.primaryColor || null, brand.logoUrl || null),
      }));
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: err.message });
    }
  });

  app.post('/transaction', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const { descriptor } = req.body as { descriptor: string };
      if (!descriptor) return reply.status(400).send({ error: 'descriptor is required in request body' });

      const result = await askAI<{ brandName: string | null; domain: string | null; confidence: number }>(
        'You are a merchant identification expert.',
        `Identify the merchant/brand from this bank transaction descriptor: "${descriptor}".

Return ONLY a JSON object with these fields:
- brandName: the identified merchant name
- domain: the most likely website domain for this merchant
- confidence: a number between 0 and 1 indicating confidence

If you cannot identify the merchant, return {"brandName": null, "domain": null, "confidence": 0}.`);

      return {
        descriptor,
        brandName: result.brandName || null,
        domain: result.domain || null,
        confidence: typeof result.confidence === 'number' ? result.confidence : 0,
      };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
}
