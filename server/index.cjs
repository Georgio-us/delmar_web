const {PgRepository}=require('./repository.cjs')
const {EditorAuth}=require('./auth.cjs')
const {createApp}=require('./app.cjs')
const {validateContent}=require('../content-validation.js')
const seed=validateContent({version:1,properties:require('./seed-properties.json'),editorial:require('./seed-editorial.cjs'),trash:[]})
async function main(){
  const repository=process.env.DATABASE_URL?new PgRepository(process.env.DATABASE_URL):null
  if(repository)await repository.initialize(seed)
  const production=process.env.NODE_ENV==='production'||Boolean(process.env.RAILWAY_ENVIRONMENT_ID)
  const auth=new EditorAuth(repository,{login:process.env.EDITOR_LOGIN,password:process.env.EDITOR_PASSWORD,production})
  if(!auth.enabled)console.warn('Editor disabled: configure DATABASE_URL, EDITOR_LOGIN and EDITOR_PASSWORD (at least 12 characters).')
  const server=createApp({repository,auth,seed,production,siteURL:process.env.SITE_URL})
  server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('DELMAR server ready'))
  const stop=()=>{server.close(async()=>{if(repository)await repository.close();process.exit(0)});setTimeout(()=>process.exit(1),10000).unref()}
  process.on('SIGTERM',stop);process.on('SIGINT',stop)
}
main().catch(error=>{console.error('Server startup failed:',error.code||error.name);process.exit(1)})
