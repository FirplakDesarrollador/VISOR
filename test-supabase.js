const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testQuery() {
    let query = supabase.from('VISOR')
        .select('*')
        .neq('Código del cliente', 'CN890927404-01');

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const dateLimit = sixMonthsAgo.toISOString().split('T')[0];
    
    query = query.gte('Fecha de ingreso', dateLimit);

    // Simulate role = 'Asesor' with empty vendedorFilter
    query = query.eq('vendedor', 'SESSION_IDENTITY_MISSING');

    console.log('Executing query...');
    const { data, error } = await query;
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Success, data length:', data?.length);
    }
}

testQuery().catch(console.error);
