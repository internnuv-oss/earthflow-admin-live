import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json();
    
    // 1. Normalize Payload Data
    const targetRole = payload.role || 'SE';
    const mobile = payload.mobile?.trim();
    const realEmail = payload.email?.trim() || null;
    const password = payload.password;
    
    // Support either "firstName lastName" or just "name"
    const name = payload.name || `${payload.firstName || ''} ${payload.lastName || ''}`.trim();

    // 🚀 2. THE CORE FIX: DYNAMIC AUTH EMAIL GENERATION
    // If SE: Force auth email to be the mobile number @gmail.com
    // If Admin/CO: Use their real provided email
    const authEmail = targetRole === 'SE' ? `${mobile}@gmail.com` : realEmail;

    if (!authEmail) {
        throw new Error("Email is required for Admin/CO accounts.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 3. Create user in Supabase Auth Table
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: authEmail, 
      password: password,
      email_confirm: true, 
      user_metadata: {
        name: name,
        mobile: mobile,
        role: targetRole,
        real_email: realEmail // Keep a safe backup of their real email in the auth metadata
      }
    });

    if (authError) throw authError;

    // 4. Overwrite public.profiles table to restore the real email
    // (Because your DB trigger might have auto-copied the synthetic mobile@gmail.com email)
    if (targetRole === 'SE' && realEmail) {
        await supabaseAdmin
            .from('profiles')
            .update({ email: realEmail }) // Put the real email in the profile table!
            .eq('id', authData.user.id);
    }

    return new Response(
      JSON.stringify({ user: authData.user, message: `${targetRole} Created Successfully` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
