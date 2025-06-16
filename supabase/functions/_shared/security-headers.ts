// Security headers based on OWASP WSTG recommendations
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-dropbox-signature',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

export const secureHeaders = {
  ...corsHeaders,
  // OWASP recommended security headers
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; object-src 'none';",
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  
  // Rate limiting information
  'X-RateLimit-Limit': '100',
  'X-RateLimit-Window': '900', // 15 minutes
};

export const errorHeaders = {
  ...secureHeaders,
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

export const successHeaders = {
  ...secureHeaders,
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
}; 