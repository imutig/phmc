
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/home/imutig/Projets/phmc/bot/.env' });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function checkConfig() {
    const { data, error } = await supabase
        .from('config')
        .select('*')
        .in('key', ['appointments_category_id', 'medical_staff_role_id', 'direction_role_id']);

    if (error) {
        console.error('Error fetching config:', error);
        return;
    }

    console.log('Config found:', data);
}

checkConfig();
