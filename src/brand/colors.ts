import * as cheerio from 'cheerio';

interface ColorsResult {
  primary: string | null;
  palette: string[];
  fonts: string[];
  styleguide: Record<string, string>;
}

const CUSTOM_PROPERTIES = ['--primary', '--brand', '--accent', '--main'];

function extractInlineStyles($: cheerio.CheerioAPI): Record<string, string> {
  const vars: Record<string, string> = {};
  $('[style]').each((_: number, el: any) => {
    const style = $(el).attr('style') || '';
    const decls = style.split(';');
    for (const decl of decls) {
      const trimmed = decl.trim();
      for (const prop of CUSTOM_PROPERTIES) {
        const regex = new RegExp(`${prop}\\s*:\\s*([^;]+)`);
        const match = trimmed.match(regex);
        if (match) vars[prop] = match[1].trim();
      }
    }
  });
  return vars;
}

function extractStyleTagVars($: cheerio.CheerioAPI): Record<string, string> {
  const vars: Record<string, string> = {};
  $('style').each((_: number, el: any) => {
    const css = $(el).html() || '';
    const rootMatch = css.match(/:root\s*\{([^}]+)\}/);
    if (rootMatch) {
      const decls = rootMatch[1].split(';');
      for (const decl of decls) {
        const trimmed = decl.trim();
        for (const prop of CUSTOM_PROPERTIES) {
          const regex = new RegExp(`${prop}\\s*:\\s*([^;]+)`);
          const match = trimmed.match(regex);
          if (match) vars[prop] = match[1].trim();
        }
      }
    }
    const globalMatch = css.match(/\*\s*\{([^}]+)\}/);
    if (globalMatch) {
      const decls = globalMatch[1].split(';');
      for (const decl of decls) {
        const trimmed = decl.trim();
        for (const prop of CUSTOM_PROPERTIES) {
          const regex = new RegExp(`${prop}\\s*:\\s*([^;]+)`);
          const match = trimmed.match(regex);
          if (match) vars[prop] = match[1].trim();
        }
      }
    }
  });
  return vars;
}

function extractFonts($: cheerio.CheerioAPI): string[] {
  const fonts = new Set<string>();
  $('[style*="font-family"]').each((_: number, el: any) => {
    const style = $(el).attr('style') || '';
    const match = style.match(/font-family\s*:\s*([^;]+)/);
    if (match) {
      match[1].split(',').forEach(f => fonts.add(f.trim().replace(/['"]/g, '')));
    }
  });
  $('link[href*="fonts"]').each((_: number, el: any) => {
    const href = $(el).attr('href') || '';
    if (href.includes('fonts.googleapis.com')) {
      const familyMatch = href.match(/family=([^&]+)/);
      if (familyMatch) {
        familyMatch[1].split('|').forEach(f => fonts.add(decodeURIComponent(f).replace(/:.*/, '').replace(/\+/g, ' ')));
      }
    }
  });
  return Array.from(fonts);
}

export function extractColors(html: string): ColorsResult {
  const $ = cheerio.load(html);

  const themeColor = $('meta[name="theme-color"]').attr('content') || null;

  const inlineVars = extractInlineStyles($);
  const styleTagVars = extractStyleTagVars($);

  const allVars = { ...styleTagVars, ...inlineVars };

  const primary = themeColor || allVars['--primary'] || allVars['--brand'] || null;

  const palette = [primary, allVars['--accent'], allVars['--main']].filter(Boolean) as string[];

  const fonts = extractFonts($);

  const styleguide: Record<string, string> = {};
  if (allVars['--primary']) styleguide['--primary'] = allVars['--primary'];
  if (allVars['--brand']) styleguide['--brand'] = allVars['--brand'];
  if (allVars['--accent']) styleguide['--accent'] = allVars['--accent'];
  if (allVars['--main']) styleguide['--main'] = allVars['--main'];
  if (themeColor) styleguide['theme-color'] = themeColor;

  return { primary, palette, fonts, styleguide };
}
