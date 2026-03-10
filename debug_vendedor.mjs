import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL or Anon Key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkVendedor() {
  const { data, error } = await supabase
    .from('VISOR')
    .select('vendedor')
    .limit(20);

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("Vendedores found:", Array.from(new Set(data.map(r => r.vendedor))));
}

checkVendedor();
