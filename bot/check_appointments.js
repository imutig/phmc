
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/home/imutig/Projets/phmc/bot/.env' });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function checkAppointments() {
    const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching appointments:', error);
        return;
    }

    console.log('Last 5 appointments:', data);
}

checkAppointments();
