// Local test fixture only, never used by the production server.
const {randomUUID}=require('node:crypto'),{Readable}=require('node:stream'),{validateUpload}=require('../server/media.cjs')
class MemoryMedia {
 constructor(){this.files=new Map()}
 async check(){return true}
 async put(type,buffer){const name=randomUUID()+'.'+validateUpload(type,buffer);this.files.set(name,{buffer,type});return {url:'/media/'+name,type,size:buffer.length}}
 async get(name,head){const file=this.files.get(name);if(!file)throw Object.assign(new Error('Missing'),{name:'NoSuchKey'});return {ContentLength:file.buffer.length,ContentType:file.type,...(head?{}:{Body:Readable.from(file.buffer)})}}
}
module.exports={MemoryMedia}
