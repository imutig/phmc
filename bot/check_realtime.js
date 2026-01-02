
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/home/imutig/Projets/phmc/bot/.env' });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function checkPublication() {
    // On ne peut pas facilement vérifier la publication via l'API JS client standard
    // Mais on peut essayer de faire une requête RPC si une fonction existe, ou juste assumer que c'est le problème.
    // Alternativement, on peut essayer de s'abonner et voir si on reçoit un event de test.

    console.log("Checking if Realtime is enabled...");

    const channel = supabase
        .channel('test-appointments')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'appointments' },
            (payload) => {
                console.log('Received event:', payload);
            }
        )
        .subscribe((status) => {
            console.log('Subscription status:', status);
        });

    // Attendre un peu pour voir si la souscription marche
    setTimeout(() => {
        console.log("Timeout reached. If status is SUBSCRIBED but no events received on insert, replication might be off.");
        process.exit(0);
    }, 5000);
}

checkPublication();
