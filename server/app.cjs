const http=require('node:http'),path=require('node:path'),fs=require('node:fs/promises')
const {validateContent}=require('../content-validation.js')
const ROOT=path.resolve(__dirname,'..')
const publicFiles=new Set(['index.html','site.css','refinement.css','iteration.css','direction.css','theme.css','editor.css','property-data.js','content-validation.js','content-store.js','script.js','editor.js','localization.js','app-loader.js'])
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.pdf':'application/pdf','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8'}
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value))}
function publicContent(result){const state=structuredClone(result.state);delete state.trash;return {...result,state}}
async function readJSON(req,max=12*1024*1024){
  if((req.headers['content-type']||'').split(';')[0]!=='application/json'){const error=new Error('Требуется JSON.');error.status=415;throw error}
  const chunks=[];let size=0
  for await(const chunk of req){size+=chunk.length;if(size>max){const error=new Error('Данные слишком большие. Уменьшите загруженные фотографии.');error.status=413;throw error}chunks.push(chunk)}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{const error=new Error('Некорректный JSON.');error.status=400;throw error}
}
function sameOrigin(req,production,siteURL){
  const origin=req.headers.origin
  if(req.headers['x-delmar-editor']!=='1'||!origin)return false
  try{const expected=siteURL||`${production?'https':'http'}://${req.headers.host}`;return new URL(origin).origin===new URL(expected).origin&&(!req.headers['sec-fetch-site']||['same-origin','none'].includes(req.headers['sec-fetch-site']))}catch{return false}
}
function createApp({repository,auth,seed,production=false,siteURL}){
  return http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY')
    res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data: https: http:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'")
    try{
      const pathname=new URL(req.url,'http://localhost').pathname
      if(pathname==='/health'){if(repository)await repository.ping();return json(res,200,{status:'ok',database:Boolean(repository),editor:Boolean(auth.enabled)})}
      if(pathname.startsWith('/api/')){
        if(['POST','PUT','DELETE','PATCH'].includes(req.method)&&!sameOrigin(req,production,siteURL))return json(res,403,{error:'Запрос должен выполняться с этого сайта.'})
        if(req.method==='GET'&&pathname==='/api/config')return json(res,200,{database:Boolean(repository),editorEnabled:auth.enabled})
        if(req.method==='GET'&&pathname==='/api/session')return json(res,200,{authenticated:await auth.authenticated(req)})
        if(req.method==='POST'&&pathname==='/api/login'){
          const data=await readJSON(req,4096),ip=(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',').at(-1).trim()
          const result=await auth.signIn(data?.login,data?.password,ip);if(result.cookie)res.setHeader('Set-Cookie',result.cookie);return json(res,result.status,result.error?{error:result.error}:{authenticated:true})
        }
        if(req.method==='POST'&&pathname==='/api/logout'){await readJSON(req,4096);res.setHeader('Set-Cookie',await auth.signOut(req));return json(res,200,{authenticated:false})}
        if(req.method==='GET'&&pathname==='/api/content'){
          const result=publicContent(repository?await repository.getContent():{state:seed,revision:0});const etag=`"${result.revision}"`;if(req.headers['if-none-match']===etag){res.writeHead(304,{'ETag':etag,'Cache-Control':'no-store'});return res.end()}
          res.setHeader('ETag',etag);return json(res,200,result)
        }
        if(req.method==='GET'&&pathname==='/api/editor/content'){if(!await auth.authenticated(req))return json(res,401,{error:'Войдите в редакционный режим.'});return json(res,200,await repository.getContent())}
        if(req.method==='PUT'&&pathname==='/api/editor/content'){
          if(!await auth.authenticated(req))return json(res,401,{error:'Сессия завершилась. Войдите заново.'})
          const data=await readJSON(req);try{validateContent(data?.state)}catch(error){return json(res,422,{error:error.message})}
          if(!Number.isSafeInteger(data.revision)||data.revision<1)return json(res,400,{error:'Не указана версия данных.'})
          const result=await repository.saveContent(data.state,data.revision);if(!result)return json(res,409,{error:'Данные уже изменены другим редактором. Обновите страницу перед сохранением.',code:'CONFLICT'})
          return json(res,200,result)
        }
        return json(res,404,{error:'API route not found.'})
      }
      if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'Method not allowed.'})
      const relative=decodeURIComponent(pathname==='/'?'/index.html':pathname).slice(1)
      if(!publicFiles.has(relative)&&!/^assets\/[\w./-]+$/.test(relative))return json(res,404,{error:'Not found.'})
      if(relative.split('/').includes('..'))return json(res,404,{error:'Not found.'})
      const filename=path.join(ROOT,relative),extension=path.extname(filename),type=mime[extension];if(!type)return json(res,404,{error:'Not found.'})
      const buffer=await fs.readFile(filename);res.writeHead(200,{'Content-Type':type,'Content-Length':buffer.length,'Cache-Control':extension==='.html'?'no-cache':'public, max-age=3600'});res.end(req.method==='HEAD'?undefined:buffer)
    }catch(error){if(error.code==='ENOENT')return json(res,404,{error:'Not found.'});if(error.status)return json(res,error.status,{error:error.message});console.error('Request failed:',error.code||error.name);if(!res.headersSent)json(res,503,{error:'Сервер временно недоступен. Попробуйте ещё раз.'});else res.end()}
  })
}
module.exports={createApp}
