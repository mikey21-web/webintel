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
  app.get('/logo/:domain', async (req, reply) => {
    try {
      const { domain } = req.params as { domain: string };
      const brand = await resolveBrand(domain);
      if (!brand || !brand.logoUrl) {
        return reply.status(404).send({ error: 'Logo not found' });
      }
      return reply.redirect(brand.logoUrl);
    } catch {
      return reply.status(404).send({ error: 'Logo not found' });
    }
  });

  app.get('/classify', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const { domain } = req.query as { domain: string };
      return await brandHandler(domain, (brand) => ({
        domain: brand.domain,
        industry: brand.industry,
        category: brand.category,
        naicsCode: brand.naicsCode,
        eicCode: brand.eicCode,
        eicSubindustry: brand.eicSubindustry,
      }));
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: err.message });
    }
  });

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

  app.get('/retrieve-simplified', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const { domain } = req.query as { domain: string };
      return await brandHandler(domain, (brand) => ({
        domain: brand.domain,
        title: brand.description,
        colors: brand.palette || [],
        logos: brand.logoUrl ? [{ url: brand.logoUrl, mode: 'light', type: 'logo' }] : [],
        backdrops: [],
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

  app.get('/retrieve-name', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const { name } = req.query as { name: string };
      if (!name || name.length < 3 || name.length > 30) {
        return reply.status(400).send({ error: 'name must be between 3-30 characters' });
      }
      const resolved = await askAI<{ domain: string | null }>(
        'You are a domain resolution expert.',
        `Given the company name "${name}", return the most likely website domain.
         Return ONLY JSON: {"domain": "company.com"} or {"domain": null} if unsure.`
      );
      if (!resolved?.domain) {
        return reply.status(404).send({ error: 'Could not resolve name to domain' });
      }
      return await brandHandler(resolved.domain, (brand) => ({
        domain: brand.domain, brandName: brand.description, logoUrl: brand.logoUrl,
        description: brand.description, industry: brand.industry, data: brand,
      }));
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: err.message });
    }
  });

  app.get('/retrieve-email', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const { email } = req.query as { email: string };
      if (!email || !email.includes('@')) {
        return reply.status(400).send({ error: 'Valid email is required' });
      }
      const freeProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com', 'proton.me', 'protonmail.com', 'mail.com', 'zoho.com'];
      const domain = email.split('@')[1].toLowerCase();
      if (freeProviders.includes(domain)) {
        return reply.status(422).send({ error: 'Free email provider detected', domain });
      }
      return await brandHandler(domain, (brand) => ({
        domain: brand.domain, brandName: brand.description, logoUrl: brand.logoUrl,
        description: brand.description, industry: brand.industry, data: brand,
      }));
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: err.message });
    }
  });

  app.get('/retrieve-ticker', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const { ticker } = req.query as { ticker: string };
      if (!ticker || ticker.length > 10) {
        return reply.status(400).send({ error: 'Valid ticker symbol is required' });
      }
      const resolved = await askAI<{ domain: string | null; companyName: string | null }>(
        'You are a stock market expert.',
        `Given the stock ticker "${ticker.toUpperCase()}", identify the company.
         Return ONLY JSON: {"domain": "company.com", "companyName": "Company Name"}
         or {"domain": null, "companyName": null} if unsure.`
      );
      if (!resolved?.domain) {
        return reply.status(404).send({ error: 'Could not resolve ticker to domain' });
      }
      return await brandHandler(resolved.domain, (brand) => ({
        domain: brand.domain, brandName: brand.description, ticker: ticker.toUpperCase(),
        logoUrl: brand.logoUrl, description: brand.description, industry: brand.industry, data: brand,
      }));
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: err.message });
    }
  });

  app.post('/prefetch', { preHandler: [requireAuth] }, async (req, reply) => {
    try {
      const { domain } = req.body as { domain: string };
      if (!domain) return reply.status(400).send({ error: 'domain is required' });
      if (req.userPlan === 'free') {
        return reply.status(402).send({ error: 'Prefetch requires a paid plan' });
      }
      resolveBrand(domain).catch(() => {});
      return reply.send({ status: 'ok', message: `Prefetch initiated for ${domain}`, domain });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.post('/prefetch-by-email', { preHandler: [requireAuth] }, async (req, reply) => {
    try {
      const { email } = req.body as { email: string };
      if (!email || !email.includes('@')) return reply.status(400).send({ error: 'Valid email is required' });
      const freeProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com', 'proton.me', 'protonmail.com', 'mail.com'];
      const domain = email.split('@')[1].toLowerCase();
      if (freeProviders.includes(domain)) {
        return reply.status(422).send({ error: 'Free email provider detected', domain });
      }
      if (req.userPlan === 'free') {
        return reply.status(402).send({ error: 'Prefetch requires a paid plan' });
      }
      resolveBrand(domain).catch(() => {});
      return reply.send({ status: 'ok', message: `Prefetch initiated for ${domain}`, domain });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
}
