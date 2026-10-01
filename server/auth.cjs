const {randomBytes,scryptSync,scrypt,timingSafeEqual,createHash}=require('node:crypto')
const {promisify}=require('node:util')
const derive=promisify(scrypt),hash=value=>createHash('sha256').update(value).digest('hex')
class EditorAuth {
  constructor(repository,{login,password,production=false}){
    this.repository=repository;this.login=login;this.enabled=Boolean(repository&&login&&password&&password.length>=12&&password.length<=256);this.cookieName=production?'__Host-delmar_session':'delmar_session';this.secure=production
    if(this.enabled){this.salt=hash('delmar-editor:'+login);this.passwordHash=scryptSync(password,this.salt,64);this.credentialTag=hash(this.passwordHash)}
  }
  token(req){const cookie=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(this.cookieName+'='));const value=cookie?.slice(this.cookieName.length+1);return /^[a-f0-9]{64}$/.test(value||'')?value:null}
  cookie(token,maxAge=28800){return `${this.cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${this.secure?'; Secure':''}`}
  async authenticated(req){const token=this.token(req);return Boolean(this.enabled&&token&&await this.repository.hasSession(hash(token),this.credentialTag))}
  async signIn(login,password,ip){
    if(!this.enabled)return {status:503,error:'Вход редактора ещё не настроен на сервере.'}
    const globalAllowed=await this.repository.takeLoginAttempt('global',50),allowed=await this.repository.takeLoginAttempt(hash(ip),5)
    if(!globalAllowed||!allowed)return {status:429,error:'Слишком много попыток. Повторите вход через 15 минут.'}
    const candidate=await derive(typeof password==='string'&&password.length<=256?password:'',this.salt,64)
    if(typeof login!=='string'||login!==this.login||typeof password!=='string'||password.length>256||!timingSafeEqual(candidate,this.passwordHash))return {status:401,error:'Проверьте логин и пароль.'}
    const token=randomBytes(32).toString('hex');await this.repository.createSession(hash(token),this.credentialTag,new Date(Date.now()+28800000));return {status:200,cookie:this.cookie(token)}
  }
  async signOut(req){const token=this.token(req);if(token&&this.repository)await this.repository.revokeSession(hash(token));return this.cookie('',0)}
}
module.exports={EditorAuth}
