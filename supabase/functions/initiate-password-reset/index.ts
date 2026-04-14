 import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
 };
 
 interface ResetRequest {
   email: string;
 }
 
 async function getM365AccessToken(): Promise<string> {
   const tenantId = Deno.env.get("M365_TENANT_ID");
   const clientId = Deno.env.get("M365_CLIENT_ID");
   const clientSecret = Deno.env.get("M365_CLIENT_SECRET");
 
   if (!tenantId || !clientId || !clientSecret) {
     throw new Error("Missing M365 credentials");
   }
 
   const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
   
   const params = new URLSearchParams();
   params.append("client_id", clientId);
   params.append("client_secret", clientSecret);
   params.append("scope", "https://graph.microsoft.com/.default");
   params.append("grant_type", "client_credentials");
 
   const response = await fetch(tokenUrl, {
     method: "POST",
     headers: { "Content-Type": "application/x-www-form-urlencoded" },
     body: params.toString(),
   });
 
   if (!response.ok) {
     const error = await response.text();
     console.error("Token error:", error);
     throw new Error(`Failed to get access token: ${response.status}`);
   }
 
   const data = await response.json();
   return data.access_token;
 }
 
 async function sendEmail(accessToken: string, to: string, subject: string, htmlBody: string): Promise<void> {
   const senderEmail = Deno.env.get("M365_SENDER_EMAIL");
   
   if (!senderEmail) {
     throw new Error("Missing M365_SENDER_EMAIL");
   }
 
   const emailPayload = {
     message: {
       subject,
       body: {
         contentType: "HTML",
         content: htmlBody,
       },
       toRecipients: [
         {
           emailAddress: { address: to },
         },
       ],
     },
     saveToSentItems: true,
   };
 
   const response = await fetch(
     `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`,
     {
       method: "POST",
       headers: {
         Authorization: `Bearer ${accessToken}`,
         "Content-Type": "application/json",
       },
       body: JSON.stringify(emailPayload),
     }
   );
 
   if (!response.ok) {
     const error = await response.text();
     console.error("Send email error:", error);
     throw new Error(`Failed to send email: ${response.status}`);
   }
 }
 
 function generateToken(): string {
   const array = new Uint8Array(32);
   crypto.getRandomValues(array);
   return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
 }
 
 async function hashToken(token: string): Promise<string> {
   const encoder = new TextEncoder();
   const data = encoder.encode(token);
   const hashBuffer = await crypto.subtle.digest("SHA-256", data);
   const hashArray = Array.from(new Uint8Array(hashBuffer));
   return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
 }
 
 serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
     const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
     const supabase = createClient(supabaseUrl, supabaseServiceKey);
 
     const { email }: ResetRequest = await req.json();
 
     if (!email) {
       return new Response(
         JSON.stringify({ error: "Missing email" }),
         { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     const normalizedEmail = email.trim().toLowerCase();
     console.log(`[initiate-password-reset] Processing reset request for: ${normalizedEmail}`);
 
     // Look up employee by private_email OR work_email
     const { data: employee, error: lookupError } = await supabase
       .from("employee_master_data")
       .select("id, first_name, last_name, private_email, work_email")
       .or(`private_email.ilike.${normalizedEmail},work_email.ilike.${normalizedEmail}`)
       .eq("is_active", true)
       .maybeSingle();
 
     // Always return success to prevent user enumeration
     // But only actually send email if employee found
     if (lookupError || !employee) {
       console.log(`[initiate-password-reset] No employee found for: ${normalizedEmail}`);
       return new Response(
         JSON.stringify({ success: true, message: "If your email is registered, you will receive a reset link." }),
         { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     // Determine which email to send to (prefer private_email if that's what they entered)
     const targetEmail = employee.private_email?.toLowerCase() === normalizedEmail 
       ? employee.private_email 
       : employee.work_email || employee.private_email;
 
     if (!targetEmail) {
       console.log(`[initiate-password-reset] Employee ${employee.id} has no email address`);
       return new Response(
         JSON.stringify({ success: true, message: "If your email is registered, you will receive a reset link." }),
         { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     // Generate token and hash it
     const token = generateToken();
     const tokenHash = await hashToken(token);
 
     console.log(`[initiate-password-reset] Creating token for employee ${employee.id}, sending to: ${targetEmail}`);
 
     // Invalidate any existing unused tokens for this employee
     await supabase
       .from("password_reset_tokens")
       .update({ used_at: new Date().toISOString() })
       .eq("employee_id", employee.id)
       .is("used_at", null);
 
     // Create new token record with hashed token
     const { error: insertError } = await supabase
       .from("password_reset_tokens")
       .insert({
         employee_id: employee.id,
         email: targetEmail,
         token_hash: tokenHash,
         expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
       });
 
     if (insertError) {
       console.error("[initiate-password-reset] Insert error:", insertError);
       return new Response(
         JSON.stringify({ error: "Failed to create reset token" }),
         { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     // Build reset URL - use production URL
     const productionUrl = "https://stork.copenhagensales.dk";
     const resetUrl = `${productionUrl}/reset-password?token=${token}`;
     
     console.log("[initiate-password-reset] Reset URL created for:", targetEmail);
 
     // Get M365 access token and send email
     const accessToken = await getM365AccessToken();
 
     const firstName = employee.first_name || "Bruger";
     const lastName = employee.last_name;
 
     const emailHtml = `
       <!DOCTYPE html>
       <html>
       <head>
         <meta charset="utf-8">
         <style>
           body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
           .container { max-width: 600px; margin: 0 auto; padding: 20px; }
           .header { background: #1a365d; color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
           .header h1 { margin: 0; font-size: 28px; font-weight: bold; letter-spacing: 1px; }
           .header p { margin: 10px 0 0 0; font-size: 18px; font-weight: normal; opacity: 0.9; }
           .content { padding: 30px; background: #ffffff; }
           .button { display: inline-block; background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 500; }
           .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; background: #f9f9f9; border-radius: 0 0 8px 8px; }
           .warning { color: #b45309; background: #fef3c7; padding: 12px; border-radius: 4px; margin: 16px 0; }
         </style>
       </head>
       <body>
         <div class="container">
           <div class="header">
             <h1>COPENHAGEN SALES</h1>
             <p>Nulstil din adgangskode</p>
           </div>
           <div class="content">
             <p>Hej ${firstName}${lastName ? " " + lastName : ""},</p>
             <p>Vi har modtaget en anmodning om at nulstille din adgangskode til Copenhagen Sales.</p>
             <p>Klik på knappen nedenfor for at oprette en ny adgangskode:</p>
             <a href="${resetUrl}" class="button">Opret ny adgangskode</a>
             <div class="warning">
               <strong>Vigtigt:</strong> Dette link udløber om 24 timer.
             </div>
             <p>Hvis du ikke har anmodet om at nulstille din adgangskode, kan du ignorere denne email.</p>
             <p>Med venlig hilsen,<br>Copenhagen Sales</p>
           </div>
           <div class="footer">
             <p>Denne email er sendt automatisk. Svar venligst ikke på denne email.</p>
           </div>
         </div>
       </body>
       </html>
     `;
 
     await sendEmail(
       accessToken,
       targetEmail,
       "Nulstil din adgangskode - Copenhagen Sales",
       emailHtml
     );
 
     console.log(`[initiate-password-reset] Password reset email sent to ${targetEmail} for employee ${employee.id}`);
 
     return new Response(
       JSON.stringify({ success: true, message: "Password reset email sent" }),
       { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   } catch (error) {
     console.error("[initiate-password-reset] Error:", error);
     // Still return success to prevent enumeration
     return new Response(
       JSON.stringify({ success: true, message: "If your email is registered, you will receive a reset link." }),
       { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });