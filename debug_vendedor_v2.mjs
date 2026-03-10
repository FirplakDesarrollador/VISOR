import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://lnphhmowklqiomownurw.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxucGhobW93a2xxaW9tb3dudXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTIwMzQwMjUsImV4cCI6MjAwNzYxMDAyNX0.FHCOWrVp-K-7qrM3CtYmYaqiOqwzsX_Au7pLm-MN3eQ";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkVendedor() {
  const { data, error } = await supabase
    .from('VISOR')
    .select('vendedor')
    .limit(50);

  if (error) {
    console.error("Error:", error);
    return;
  }

  const v = Array.from(new Set(data.map(r => r.vendedor)));
  console.log("Vendedores sample:", v);
}

checkVendedor();
