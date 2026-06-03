export function normalizeDomain(domain: string): string {
  let d = domain.toLowerCase().trim();
  d = d.replace(/^(https?:\/\/)?(www\.)?/, '');
  d = d.replace(/\/.*$/, '');
  return d;
}

export function domainToUrl(domain: string): string {
  const d = normalizeDomain(domain);
  return `https://${d}`;
}
