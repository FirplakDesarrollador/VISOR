import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    if (line.includes('=')) {
        const [k, v] = line.split('=');
        env[k.trim()] = v.trim();
    }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
    const { data, error } = await supabase.rpc('get_tables'); // This might not work if RPC not defined
    
    if (error) {
        // Fallback: try to select from information_schema if possible, but Anon key usually can't
        console.error('RPC failed, trying simple select...');
        const { data: d2, error: e2 } = await supabase.from('Usuarios').select('*').limit(1);
        if (e2) console.error('Usuarios failed:', e2.message);
        
        const { data: d3, error: e3 } = await supabase.from('usuarios').select('*').limit(1);
        if (e3) console.error('usuarios failed:', e3.message);
    } else {
        console.log('Tables:', data);
    }
}

run().catch(console.error);
