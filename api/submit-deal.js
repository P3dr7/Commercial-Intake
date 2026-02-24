// Environment variables (set in Vercel dashboard - NEVER expose in frontend)
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'temp_files';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // max 10 requests per minute per IP

// In-memory rate limit store (resets on cold start, but good enough for basic protection)
const rateLimitStore = new Map();

// File validation constants
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/gif',
];
const ALLOWED_FILE_CATEGORIES = ['pnl', 'rentRoll', 't12', 'om', 'capex', 'utility', 'financialInfo'];

// CORS headers
function getCorsHeaders(origin) {
  const isAllowed = ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin) || origin?.includes('vercel.app');
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0] || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
  };
}

// Rate limiting check
function checkRateLimit(ip) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  
  // Clean old entries
  for (const [key, data] of rateLimitStore.entries()) {
    if (data.timestamp < windowStart) {
      rateLimitStore.delete(key);
    }
  }
  
  const clientData = rateLimitStore.get(ip);
  
  if (!clientData) {
    rateLimitStore.set(ip, { count: 1, timestamp: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }
  
  if (clientData.timestamp < windowStart) {
    rateLimitStore.set(ip, { count: 1, timestamp: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }
  
  if (clientData.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }
  
  clientData.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - clientData.count };
}

// Input validation
function validateFormData(body) {
  const errors = [];
  
  // Required fields
  if (!body.propertyName || typeof body.propertyName !== 'string' || body.propertyName.trim().length < 2) {
    errors.push('Property Name is required and must be at least 2 characters');
  }
  
  if (!body.propertyType || typeof body.propertyType !== 'string') {
    errors.push('Property Type is required');
  }
  
  // Submitter info validation
  if (!body.submitterName || typeof body.submitterName !== 'string' || body.submitterName.trim().length < 2) {
    errors.push('Your Name is required and must be at least 2 characters');
  }
  
  if (!body.submitterPhone || typeof body.submitterPhone !== 'string') {
    errors.push('Your Phone is required');
  }
  
  if (!body.submitterEmail || typeof body.submitterEmail !== 'string') {
    errors.push('Your Email is required');
  } else {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.submitterEmail)) {
      errors.push('Invalid email format');
    }
  }
  
  // Final acknowledgement
  if (body.finalAcknowledgement !== 'true' && body.finalAcknowledgement !== true) {
    errors.push('Final acknowledgement is required');
  }
  
  // Sanitize strings to prevent injection
  const sanitizedBody = {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string') {
      // Remove potentially dangerous characters, allow common punctuation
      sanitizedBody[key] = value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/[<>]/g, '')
        .trim()
        .substring(0, 10000); // Limit length
    } else {
      sanitizedBody[key] = value;
    }
  }
  
  return { errors, sanitizedBody };
}

// Upload file to Supabase Storage
async function uploadToSupabase(fileBuffer, filename, mimetype, category) {
  const timestamp = Date.now();
  const randomId = Array.from(crypto.getRandomValues(new Uint8Array(8))).map(b => b.toString(16).padStart(2, '0')).join('');
  const sanitizedName = filename.replace(/[^a-zA-Z0-9.-]/g, '_').substring(0, 100);
  const filePath = `uploads/${timestamp}-${randomId}-${sanitizedName}`;

  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${filePath}`;

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': mimetype,
    },
    body: fileBuffer,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Storage upload failed: ${response.status} - ${error}`);
  }

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${filePath}`;
  return {
    category,
    originalname: filename,
    url: publicUrl,
    key: filePath,
  };
}

// Parse multipart form data
async function parseMultipartFormData(request) {
  const contentType = request.headers.get('content-type') || '';
  
  if (!contentType.includes('multipart/form-data')) {
    throw new Error('Invalid content type. Expected multipart/form-data');
  }
  
  const formData = await request.formData();
  const fields = {};
  const files = [];
  
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      // Validate file
      if (value.size > MAX_FILE_SIZE) {
        throw new Error(`File ${value.name} exceeds maximum size of 25MB`);
      }
      
      if (!ALLOWED_MIME_TYPES.includes(value.type)) {
        throw new Error(`File type ${value.type} is not allowed for ${value.name}`);
      }
      
      if (!ALLOWED_FILE_CATEGORIES.includes(key)) {
        throw new Error(`Invalid file category: ${key}`);
      }
      
      const buffer = await value.arrayBuffer();
      files.push({
        fieldname: key,
        originalname: value.name,
        mimetype: value.type,
        size: value.size,
        buffer: Buffer.from(buffer),
      });
    } else {
      fields[key] = value;
    }
  }
  
  return { fields, files };
}

// Main handler
export default async function handler(request) {
  const origin = request.headers.get('origin') || '';
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  
  // Only allow POST
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: corsHeaders }
    );
  }
  
  try {
    // Get client IP for rate limiting
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || request.headers.get('x-real-ip') 
      || 'unknown';
    
    // Check rate limit
    const rateLimit = checkRateLimit(clientIp);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Too many requests. Please try again later.',
          retryAfter: 60 
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Retry-After': '60',
            'X-RateLimit-Remaining': '0'
          } 
        }
      );
    }
    
    // Validate environment configuration
    if (!WEBHOOK_URL) {
      console.error('WEBHOOK_URL not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { status: 500, headers: corsHeaders }
      );
    }
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error('Supabase configuration missing');
      return new Response(
        JSON.stringify({ success: false, error: 'Storage configuration error' }),
        { status: 500, headers: corsHeaders }
      );
    }
    
    // Parse form data
    let fields, files;
    try {
      const parsed = await parseMultipartFormData(request);
      fields = parsed.fields;
      files = parsed.files;
    } catch (parseError) {
      return new Response(
        JSON.stringify({ success: false, error: parseError.message }),
        { status: 400, headers: corsHeaders }
      );
    }
    
    // Validate form data
    const { errors, sanitizedBody } = validateFormData(fields);
    
    // Check required files
    const uploadedCategories = new Set(files.map(f => f.fieldname));
    if (!uploadedCategories.has('financialInfo')) {
      errors.push('Financial Information document is required');
    }
    
    if (errors.length > 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Validation failed', details: errors }),
        { status: 400, headers: corsHeaders }
      );
    }
    
    // Upload files to Supabase
    const uploadedFiles = [];
    for (const file of files) {
      try {
        const result = await uploadToSupabase(
          file.buffer,
          file.originalname,
          file.mimetype,
          file.fieldname
        );
        uploadedFiles.push(result);
      } catch (uploadError) {
        console.error(`Failed to upload ${file.originalname}:`, uploadError.message);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Failed to upload file: ${file.originalname}` 
          }),
          { status: 500, headers: corsHeaders }
        );
      }
    }
    
    // Prepare webhook payload (sanitized data only)
    const webhookPayload = {
      ...sanitizedBody,
      serverTimestamp: new Date().toISOString(),
      serverProcessed: true,
      clientIp: clientIp.substring(0, 45), // Truncate IP for privacy
      files: uploadedFiles.reduce((acc, file) => {
        acc[file.category] = {
          originalname: file.originalname,
          url: file.url,
        };
        return acc;
      }, {}),
      fileUrls: uploadedFiles.map(f => f.url),
    };
    
    // Send to webhook
    const webhookResponse = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SubmiteForm-Backend/1.0',
      },
      body: JSON.stringify(webhookPayload),
    });
    
    if (!webhookResponse.ok) {
      console.error('Webhook error:', webhookResponse.status);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to process submission. Please try again.' 
        }),
        { status: 502, headers: corsHeaders }
      );
    }
    
    // Success response (don't expose webhook response details)
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Submission received successfully' 
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders,
          'X-RateLimit-Remaining': String(rateLimit.remaining)
        } 
      }
    );
    
  } catch (error) {
    console.error('Unexpected error:', error);
    
    // Generic error response (don't expose internal details)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'An unexpected error occurred. Please try again.' 
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}

export const config = {
  runtime: 'edge',
};
