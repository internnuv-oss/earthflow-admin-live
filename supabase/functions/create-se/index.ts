import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 🚀 Changed from serve() to the modern Deno.serve()
Deno.serve(async (req) => {
  // 1. Respond to the browser's CORS preflight check immediately
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { firstName, lastName, dob, mobile, email, password } = await req.json()

    // 2. Initialize the Supabase Admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 3. Create the user using the Admin API
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: `${mobile.trim()}@gmail.com`,
      password: password,
      email_confirm: true, 
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        name: `${firstName} ${lastName}`.trim(), 
        real_email: email,
        mobile: mobile,
        dob: dob,
        role: 'SE'
      }
    })

    if (error) throw error

    return new Response(
      JSON.stringify({ user: data.user, message: "SE Created Successfully" }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})