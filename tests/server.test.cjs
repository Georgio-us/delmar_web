const {test}=require('node:test'),assert=require('node:assert/strict'),{randomBytes}=require('node:crypto')
const {createApp}=require('../server/app.cjs'),{EditorAuth}=require('../server/auth.cjs'),{MemoryRepository}=require('./memory-repository.cjs'),{validateContent}=require('../content-validation.js')
const seed={version:1,properties:require('../server/seed-properties.json'),editorial:require('../server/seed-editorial.cjs'),trash:[]}

test('shared content, authentication, conflicts, validation and logout',async t=>{
 const repo=new MemoryRepository(seed),password=randomBytes(24).toString('hex'),auth=new EditorAuth(repo,{login:'test-editor',password}),server=createApp({repository:repo,auth,seed})
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)))
 const base='http://127.0.0.1:'+server.address().port
 const request=(route,method='GET',body,cookie,origin=base)=>fetch(base+route,{method,headers:{Origin:origin,'X-Delmar-Editor':'1','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})})
 assert.equal((await request('/health')).status,200)
 assert.equal((await request('/api/editor/content')).status,401)
 assert.equal((await request('/api/login','POST',{login:'test-editor',password},null,'https://foreign.example')).status,403)
 assert.equal((await request('/api/login','POST',{login:'test-editor',password:'incorrect'})).status,401)
 const login=await request('/api/login','POST',{login:'test-editor',password});assert.equal(login.status,200)
 const cookie=login.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/)
 assert.equal((await (await request('/api/session','GET',undefined,cookie)).json()).authenticated,true)
 const initial=await (await request('/api/editor/content','GET',undefined,cookie)).json();assert.equal(initial.state.properties.length,25)
 const edited=structuredClone(initial.state);edited.properties[0].price=123456
 assert.equal((await request('/api/editor/content','PUT',{state:edited,revision:1})).status,401)
 const save=await request('/api/editor/content','PUT',{state:edited,revision:1},cookie);assert.equal(save.status,200);assert.equal((await save.json()).revision,2)
 const publicView=await (await request('/api/content')).json();assert.equal(publicView.state.properties[0].price,123456);assert.equal('trash' in publicView.state,false)
 assert.equal((await request('/api/editor/content','PUT',{state:edited,revision:1},cookie)).status,409)
 edited.properties[0].photos=['javascript:alert(1)'];assert.equal((await request('/api/editor/content','PUT',{state:edited,revision:2},cookie)).status,422)
 assert.equal((await request('/api/editor/content','PUT',null,cookie)).status,422)
 const restartedAuth=new EditorAuth(repo,{login:'test-editor',password});assert.equal(await restartedAuth.authenticated({headers:{cookie}}),true)
 const changedPassword=new EditorAuth(repo,{login:'test-editor',password:randomBytes(24).toString('hex')});assert.equal(await changedPassword.authenticated({headers:{cookie}}),false)
 assert.equal((await request('/server/index.cjs')).status,404);assert.equal((await request('/.env')).status,404);assert.equal((await request('/index.html')).status,200)
 await request('/api/logout','POST',{},cookie);assert.equal((await request('/api/editor/content','GET',undefined,cookie)).status,401)
})
test('rate limiting and production cookies',async()=>{
 const repo=new MemoryRepository(seed),auth=new EditorAuth(repo,{login:'editor',password:'test-only-password',production:true})
 for(let i=0;i<5;i++)assert.equal((await auth.signIn('editor','wrong','one-ip')).status,401)
 assert.equal((await auth.signIn('editor','test-only-password','one-ip')).status,429)
 const result=await auth.signIn('editor','test-only-password','second-ip');assert.equal(result.status,200);assert.match(result.cookie,/^__Host-delmar_session=/);assert.match(result.cookie,/; Secure/)
 const token=result.cookie.split(';')[0];for(const session of repo.sessions.values())session.expires=new Date(0)
 assert.equal(await auth.authenticated({headers:{cookie:token}}),false)
})
test('seed and invalid editorial/deleted data validation',()=>{
 assert.equal(validateContent(structuredClone(seed)).properties.length,25)
 for(const mutate of [s=>s.properties[0].price=0,s=>s.properties[0].rooms=1.5,s=>s.editorial.top[1]=s.editorial.top[0],s=>s.editorial.exclusives=null,s=>s.properties[0]=null,s=>s.trash=[{}],s=>s.trash=[{property:{...s.properties[0],id:'p_deleted',photos:['javascript:bad']},editorial:s.editorial}]]){
  const value=structuredClone(seed);mutate(value);assert.throws(()=>validateContent(value))
 }
})
