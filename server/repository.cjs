const {Pool}=require('pg')
class PgRepository {
  constructor(connectionString){this.pool=new Pool({connectionString,max:5,connectionTimeoutMillis:10000,idleTimeoutMillis:30000});this.pool.on('error',error=>console.error('Database pool error:',error.code||'unavailable'))}
  async initialize(seed){
    await this.pool.query(`CREATE TABLE IF NOT EXISTS delmar_content (id integer PRIMARY KEY CHECK (id=1), state jsonb NOT NULL, revision integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS delmar_sessions (token_hash text PRIMARY KEY, credential_tag text NOT NULL, expires_at timestamptz NOT NULL);
      CREATE TABLE IF NOT EXISTS delmar_leads (id uuid PRIMARY KEY, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS delmar_login_limits (key text PRIMARY KEY, attempts integer NOT NULL, expires_at timestamptz NOT NULL);`)
    await this.pool.query('INSERT INTO delmar_content(id,state) VALUES(1,$1::jsonb) ON CONFLICT(id) DO NOTHING',[JSON.stringify(seed)])
  }
  async getContent(){const {rows}=await this.pool.query('SELECT state,revision FROM delmar_content WHERE id=1');if(!rows[0])throw new Error('Missing content');return rows[0]}
  async saveContent(state,revision){const {rows}=await this.pool.query('UPDATE delmar_content SET state=$1::jsonb,revision=revision+1,updated_at=now() WHERE id=1 AND revision=$2 RETURNING state,revision',[JSON.stringify(state),revision]);return rows[0]||null}
  async createSession(tokenHash,credentialTag,expires){await this.pool.query('DELETE FROM delmar_sessions WHERE expires_at < now()');await this.pool.query('INSERT INTO delmar_sessions(token_hash,credential_tag,expires_at) VALUES($1,$2,$3)',[tokenHash,credentialTag,expires])}
  async hasSession(tokenHash,credentialTag){const {rows}=await this.pool.query('SELECT token_hash FROM delmar_sessions WHERE token_hash=$1 AND credential_tag=$2 AND expires_at>now()',[tokenHash,credentialTag]);return rows.length>0}
  async revokeSession(tokenHash){await this.pool.query('DELETE FROM delmar_sessions WHERE token_hash=$1',[tokenHash])}
  async takeLoginAttempt(key,limit){
    const {rows}=await this.pool.query(`INSERT INTO delmar_login_limits(key,attempts,expires_at) VALUES($1,1,now()+interval '15 minutes')
      ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN delmar_login_limits.expires_at<=now() THEN 1 ELSE delmar_login_limits.attempts+1 END,
      expires_at=CASE WHEN delmar_login_limits.expires_at<=now() THEN now()+interval '15 minutes' ELSE delmar_login_limits.expires_at END RETURNING attempts`,[key])
    await this.pool.query('DELETE FROM delmar_login_limits WHERE expires_at<now()')
    return rows[0].attempts<=limit
  }
  async createLead(lead){await this.pool.query('INSERT INTO delmar_leads(id,data) VALUES($1,$2::jsonb)',[lead.id,JSON.stringify(lead)])}
  async getLeads(){const {rows}=await this.pool.query('SELECT data,created_at FROM delmar_leads ORDER BY created_at DESC LIMIT 100');return rows.map(row=>({...row.data,created_at:row.created_at}))}
  async ping(){await this.pool.query('SELECT 1')}
  async close(){await this.pool.end()}
}
module.exports={PgRepository}
