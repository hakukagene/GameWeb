import { openDatabase } from '../server/database.mjs';
const email=(process.argv[2]||'').trim().toLowerCase();
const role=process.argv[3]||'admin';
if(!email||!['admin','user'].includes(role)) {
  console.error('Usage: npm run admin:set -- "your@email.com" [admin|user]');process.exitCode=1;
} else {
  const db=openDatabase(process.env.DB_PATH||'./data/storyplay.sqlite');
  try {
    const result=db.prepare('UPDATE users SET role=? WHERE email=?').run(role,email);
    if(!result.changes)throw Error('Account not found. Register this email on the website first; check DB_PATH if you use a custom database.');
    console.log(`Role set to ${role} for ${email}. Refresh the website and open /admin.`);
  }catch(e){console.error(e.message);process.exitCode=1;}finally{db.close();}
}
