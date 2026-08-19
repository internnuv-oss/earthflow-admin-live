import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai'

const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)
const genAI = new GoogleGenerativeAI(geminiApiKey)

serve(async (req) => {
  try {
    const payload = await req.json()
    // We now receive the table name from the SQL trigger
    const { table, record } = payload

    if (!record) {
      return new Response("No record found", { status: 200 })
    }

    const stringsToTranslate: string[] = [];

    // Dynamically grab strings based on which table triggered the function
    if (table === 'master_parameters') {
      if (record.parameter_label) stringsToTranslate.push(record.parameter_label.trim());
      if (Array.isArray(record.options_data)) {
        record.options_data.forEach(opt => {
          if (typeof opt === 'string' && opt.trim()) stringsToTranslate.push(opt.trim());
        });
      }
    } else if (table === 'master_crops') {
      if (record.crop_name) stringsToTranslate.push(record.crop_name.trim());
      if (record.crop_category) stringsToTranslate.push(record.crop_category.trim());
    } else if (table === 'master_crop_stages') {
      if (record.stage_name) stringsToTranslate.push(record.stage_name.trim());
    } else if (table === 'master_gls_products') {
      if (record.product_name) stringsToTranslate.push(record.product_name.trim());
    } else if (table === 'master_uom') {
      if (record.uom_name) stringsToTranslate.push(record.uom_name.trim());
    }

    // Remove duplicates and empty strings
    const uniqueStrings = [...new Set(stringsToTranslate.filter(s => s && s.length > 0))];

    if (uniqueStrings.length === 0) {
      return new Response("No valid strings to translate", { status: 200 });
    }

    // Check which strings are ALREADY in dynamic_translations
    const { data: existing } = await supabase
      .from('dynamic_translations')
      .select('english_key')
      .in('english_key', uniqueStrings);

    const existingKeys = new Set((existing || []).map(e => e.english_key));
    const missingStrings = uniqueStrings.filter(s => !existingKeys.has(s));

    if (missingStrings.length === 0) {
      return new Response("Strings already translated. Skipping Gemini.", { status: 200 });
    }

    // Call Gemini ONLY for untranslated strings
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" })
    const prompt = `You are an expert translator for an Indian Agricultural Application.
    Translate this JSON array of English agricultural terms into Hindi and Gujarati. 
    
    STRICT RULES:
    1. The "hi" value MUST be in the Hindi Devanagari script.
    2. The "gu" value MUST be in the Gujarati script. Do NOT put Hindi text in the "gu" field.
    
    Return ONLY a valid JSON object format: { "EnglishTerm": { "hi": "HindiTranslation", "gu": "GujaratiTranslation" } }
    Data: ${JSON.stringify(missingStrings)}`;

    const result = await model.generateContent(prompt);
    const cleanedText = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    const translationJSON = JSON.parse(cleanedText);

    const dbPayload = Object.keys(translationJSON).map(engKey => ({
      english_key: engKey,
      hindi_val: translationJSON[engKey].hi,
      gujarati_val: translationJSON[engKey].gu
    }));

    const { error } = await supabase
      .from('dynamic_translations')
      .upsert(dbPayload, { onConflict: 'english_key' });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, translated_count: dbPayload.length }), {
      headers: { "Content-Type": "application/json" },
      status: 200
    })

  } catch (error) {
    console.error("Translation Error:", error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})