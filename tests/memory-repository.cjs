// Test adapter only. Production always uses PgRepository.
class MemoryRepository {
  constructor(seed){this.state=structuredClone(seed);this.revision=1;this.sessions=new Map();this.attempts=new Map()}
  async getContent(){return {state:structuredClone(this.state),revision:this.revision}}
  async saveContent(state,revision){if(revision!==this.revision)return null;this.state=structuredClone(state);this.revision++;return this.getContent()}
  async createSession(token,tag,expires){this.sessions.set(token,{tag,expires})}
  async hasSession(token,tag){const session=this.sessions.get(token);return Boolean(session&&session.tag===tag&&session.expires>Date.now())}
  async revokeSession(token){this.sessions.delete(token)}
  async takeLoginAttempt(key,limit){const count=(this.attempts.get(key)||0)+1;this.attempts.set(key,count);return count<=limit}
  async ping(){}
}
module.exports={MemoryRepository}
