// Local test fixture. Never used by npm start or Railway.
const {MemoryMedia}=require('./memory-media.cjs')
const {createApp}=require('../server/app.cjs'),{EditorAuth}=require('../server/auth.cjs'),{MemoryRepository}=require('./memory-repository.cjs')
const seed={version:1,properties:require('../server/seed-properties.json'),editorial:require('../server/seed-editorial.cjs'),trash:[]}
if(process.env.PREVIEW_EMPTY==='1'){seed.properties=[];seed.editorial={top:[null,null,null],exclusives:[]}}
const repository=new MemoryRepository(seed),auth=new EditorAuth(repository,{login:'preview',password:'preview-test-only-2026'})
createApp({repository,auth,seed,media:new MemoryMedia()}).listen(Number(process.env.PREVIEW_PORT)||4180,'127.0.0.1',()=>console.log('Local API preview ready'))
