import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // 1. Respond to CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Parse the dynamic payload from AdminUserManagement
    const { name, mobile, email, password, role } = await req.json()

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 3. Create the user
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: email, // Use the provided email
      password: password,
      email_confirm: true, 
      user_metadata: {
        name: name,
        mobile: mobile,
        role: role // Dynamically assign TH, CO, or SE
      }
    })

    if (error) throw error

    return new Response(
      JSON.stringify({ user: data.user, message: `${role} Created Successfully` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})