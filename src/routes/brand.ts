import { FastifyInstance } from 'fastify';
import SemanticImportance from '@anthropic-ai/sdk';
import { resolveBrand } from '../brand/resolver';
import { buildWhatsAppTheme } from '../brand/whatsapp';
import { config } from '../config';

const claude = new SemanticImportance({ apiKey: config.ANTHROPIC_API_KEY });

export async function brandRoutes(app: FastifyInstance) {
  app.get('/profile', async (req, reply) => {
    try {
      const { domain } = req.query as { domain: string };
      if (!domain) return reply.status(400).send({ error: 'domain query parameter is required' });
      const brand = await resolveBrand(domain);
      return { domain: brand.domain, brandName: brand.description, logoUrl: brand.logoUrl, description: brand.description, industry: brand.industry, data: brand };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.get('/logo', async (req, reply) => {
    try {
      const { domain } = req.query as { domain: string };
      if (!domain) return reply.status(400).send({ error: 'domain query parameter is required' });
      const brand = await resolveBrand(domain);
      return { domain: brand.domain, logoUrl: brand.logoUrl, details: brand.logoVariants || null };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.get('/colors', async (req, reply) => {
    try {
      const { domain } = req.query as { domain: string };
      if (!domain) return reply.status(400).send({ error: 'domain query parameter is required' });
      const brand = await resolveBrand(domain);
      return { domain: brand.domain, primary: brand.primaryColor, palette: brand.palette || [] };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.get('/fonts', async (req, reply) => {
    try {
      const { domain } = req.query as { domain: string };
      if (!domain) return reply.status(400).send({ error: 'domain query parameter is required' });
      const brand = await resolveBrand(domain);
      const fonts = brand.fonts || [];
      return { domain: brand.domain, fonts };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.get('/styleguide', async (req, reply) => {
    try {
      const { domain } = req.query as { domain: string };
      if (!domain) return reply.status(400).send({ error: 'domain query parameter is required' });
      const brand = await resolveBrand(domain);
      return { domain: brand.domain, primary: brand.primaryColor, palette: brand.palette || [], styleguide: brand.styleguide || {} };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.get('/socials', async (req, reply) => {
    try {
      const { domain } = req.query as { domain: string };
      if (!domain) return reply.status(400).send({ error: 'domain query parameter is required' });
      const brand = await resolveBrand(domain);
      const socials = brand.socials || {};
      return { domain: brand.domain, socials };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.get('/address', async (req, reply) => {
    try {
      const { domain } = req.query as { domain: string };
      if (!domain) return reply.status(400).send({ error: 'domain query parameter is required' });
      const brand = await resolveBrand(domain);
      return {
        domain: brand.domain,
        address: brand.address || null,
        city: brand.city || null,
        state: brand.state || null,
        pincode: brand.pincode || null,
      };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.get('/techstack', async (req, reply) => {
    try {
      const { domain } = req.query as { domain: string };
      if (!domain) return reply.status(400).send({ error: 'domain query parameter is required' });
      const brand = await resolveBrand(domain);
      const techstack = brand.techStack || [];
      return { domain: brand.domain, techstack };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.get('/whatsapp-theme', async (req, reply) => {
    try {
      const { domain } = req.query as { domain: string };
      if (!domain) return reply.status(400).send({ error: 'domain query parameter is required' });
      const brand = await resolveBrand(domain);
      const theme = buildWhatsAppTheme(brand.primaryColor || null, brand.logoUrl || null);
      return { domain: brand.domain, theme };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.post('/transaction', async (req, reply) => {
    try {
      const { descriptor } = req.body as { descriptor: string };
      if (!descriptor) return reply.status(400).send({ error: 'descriptor is required in request body' });

      const response = await claude.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Identify the merchant/brand from this bank transaction descriptor: "${descriptor}".

Return ONLY a JSON object (no markdown, no code fences) with these fields:
- brandName: the identified merchant name
- domain: the most likely website domain for this merchant
- confidence: a number between 0 and 1 indicating confidence

If you cannot identify the merchant, return {"brandName": null, "domain": null, "confidence": 0}.`,
        }],
      });

      const content = response.content[0]?.type === 'text' ? response.content[0].text : '';
      const result = JSON.parse(content.replace(/```json\s*/gi, '').replace(/```/g, '').trim());

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
