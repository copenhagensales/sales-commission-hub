import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TrustedIpRange {
  name: string;
  ip: string;
}

function getClientIp(req: Request): string {
  // Get IP from x-forwarded-for header (common for proxied requests)
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // Take the first IP in the list (client IP)
    return forwardedFor.split(",")[0].trim();
  }
  
  // Fallback to cf-connecting-ip (Cloudflare)
  const cfConnectingIp = req.headers.get("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp;
  }
  
  // Last fallback
  return "unknown";
}

function ipToNumber(ip: string): number {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return 0;
  return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function isIpInCidr(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split("/");
  const mask = bits ? parseInt(bits) : 32;
  
  const ipNum = ipToNumber(ip);
  const rangeNum = ipToNumber(range);
  const maskBits = ~((1 << (32 - mask)) - 1);
  
  return (ipNum & maskBits) === (rangeNum & maskBits);
}

function isIpInWildcard(ip: string, pattern: string): boolean {
  const ipParts = ip.split(".");
  const patternParts = pattern.split(".");
  
  if (ipParts.length !== 4 || patternParts.length !== 4) return false;
  
  for (let i = 0; i < 4; i++) {
    if (patternParts[i] !== "*" && patternParts[i] !== ipParts[i]) {
      return false;
    }
  }
  return true;
}

function matchIp(clientIp: string, ipRange: string): boolean {
  // Normalize
  const normalizedRange = ipRange.trim();
  
  // CIDR notation (e.g., 192.168.1.0/24)
  if (normalizedRange.includes("/")) {
    return isIpInCidr(clientIp, normalizedRange);
  }
  
  // Wildcard notation (e.g., 192.168.*.*)
  if (normalizedRange.includes("*")) {
    return isIpInWildcard(clientIp, normalizedRange);
  }
  
  // Exact match
  return clientIp === normalizedRange;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ exempt: false, error: "No authorization header" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user from token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user?.email) {
      console.log("User auth error:", userError);
      return new Response(
        JSON.stringify({ exempt: false, error: "Invalid user" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get client IP
    const clientIp = getClientIp(req);
    console.log(`Checking MFA exemption for user ${user.email} from IP ${clientIp}`);

    // Get employee's job position
    const { data: employee, error: empError } = await supabase
      .from("employee_master_data")
      .select("job_title")
      .eq("private_email", user.email)
      .maybeSingle();

    if (empError || !employee?.job_title) {
      console.log("Employee not found or no job title:", empError);
      return new Response(
        JSON.stringify({ exempt: false, ip: clientIp }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get position's trusted IP ranges
    const { data: position, error: posError } = await supabase
      .from("job_positions")
      .select("trusted_ip_ranges")
      .eq("name", employee.job_title)
      .maybeSingle();

    if (posError || !position) {
      console.log("Position not found:", posError);
      return new Response(
        JSON.stringify({ exempt: false, ip: clientIp }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const trustedRanges = (position.trusted_ip_ranges || []) as TrustedIpRange[];
    
    if (trustedRanges.length === 0) {
      return new Response(
        JSON.stringify({ exempt: false, ip: clientIp }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if client IP matches any trusted range
    for (const range of trustedRanges) {
      if (matchIp(clientIp, range.ip)) {
        console.log(`IP ${clientIp} matches trusted range "${range.name}" (${range.ip})`);
        return new Response(
          JSON.stringify({ 
            exempt: true, 
            ip: clientIp, 
            matched_range: range.name 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log(`IP ${clientIp} does not match any trusted ranges`);
    return new Response(
      JSON.stringify({ exempt: false, ip: clientIp }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error checking MFA exemption:", error);
    return new Response(
      JSON.stringify({ exempt: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
