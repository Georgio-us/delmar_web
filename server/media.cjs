const {randomUUID}=require('node:crypto')
const {S3Client,PutObjectCommand,GetObjectCommand,HeadObjectCommand,ListObjectsV2Command}=require('@aws-sdk/client-s3')
const MEDIA_NAME=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.(jpg|png|webp|pdf)$/
const TYPES={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf'}
function validateUpload(type,buffer){
 const extension=TYPES[type]
 if(!extension)throw Object.assign(new Error('Допустимы JPG, PNG, WebP или PDF.'),{status:415})
 const limit=extension==='pdf'?20*1024*1024:10*1024*1024
 if(!buffer.length||buffer.length>limit)throw Object.assign(new Error(extension==='pdf'?'PDF должен быть не больше 20 МБ.':'Фотография должна быть не больше 10 МБ.'),{status:413})
 const signature=extension==='jpg'?buffer.subarray(0,3).equals(Buffer.from([255,216,255])):extension==='png'?buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):extension==='webp'?buffer.subarray(0,4).toString()==='RIFF'&&buffer.subarray(8,12).toString()==='WEBP':buffer.subarray(0,5).toString()==='%PDF-'
 if(!signature)throw Object.assign(new Error('Содержимое файла не соответствует выбранному формату.'),{status:422})
 return extension
}
class R2Media {
 constructor({endpoint,bucket,accessKeyId,secretAccessKey}){
  const url=new URL(endpoint)
  if(url.protocol!=='https:'||!/^([a-f0-9]{32})(\.(eu|us|fedramp))?\.r2\.cloudflarestorage\.com$/.test(url.hostname)||url.pathname!=='/'||url.search||url.username||url.password||!bucket)throw new Error('Invalid R2 configuration')
  this.bucket=bucket;this.client=new S3Client({region:'auto',endpoint,forcePathStyle:true,credentials:{accessKeyId,secretAccessKey},maxAttempts:2,requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED'});this.checkedAt=0;this.ready=false
 }
 async check(){
  if(Date.now()-this.checkedAt<60000)return this.ready
  this.checkedAt=Date.now()
  try{await this.client.send(new ListObjectsV2Command({Bucket:this.bucket,Prefix:'delmar-media/',MaxKeys:1}),{abortSignal:AbortSignal.timeout(10000)});this.ready=true}catch{this.ready=false}
  return this.ready
 }
 async put(type,buffer){
  const extension=validateUpload(type,buffer),name=randomUUID()+'.'+extension
  await this.client.send(new PutObjectCommand({Bucket:this.bucket,Key:'delmar-media/'+name,Body:buffer,ContentType:type,CacheControl:'public, max-age=31536000, immutable'}),{abortSignal:AbortSignal.timeout(45000)})
  return {url:'/media/'+name,type,size:buffer.length}
 }
 async get(name,head=false){
  if(!MEDIA_NAME.test(name))throw Object.assign(new Error('Not found'),{status:404})
  const Command=head?HeadObjectCommand:GetObjectCommand
  return this.client.send(new Command({Bucket:this.bucket,Key:'delmar-media/'+name}),{abortSignal:AbortSignal.timeout(20000)})
 }
 close(){this.client.destroy()}
}
module.exports={R2Media,validateUpload,MEDIA_NAME,TYPES}
