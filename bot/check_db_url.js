
require('dotenv').config({ path: '/home/imutig/Projets/phmc/bot/.env' });
if (process.env.DATABASE_URL) {
    console.log("Yes");
} else {
    console.log("No");
}
