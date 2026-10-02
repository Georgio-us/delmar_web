const {randomUUID}=require('node:crypto')
function validateLead(data){
 const fail=message=>{throw Object.assign(new Error(message),{status:422})}
 if(!data||typeof data!=='object')fail('Заполните заявку.')
 const lead={id:randomUUID()}
 for(const [key,max,required]of [['name',100,true],['phone',40,true],['source',160,true],['sourceLabel',200,false],['title',200,true],['interest',160,false],['developer',160,false],['propertyId',72,false],['summary',400,false],['message',2000,false]]){
  const value=data[key]??'';if(typeof value!=='string'||value.length>max||(required&&!value.trim()))fail('Проверьте имя, телефон и текст заявки.');lead[key]=value.trim()
 }
 if(!/^[+\d\s().-]+$/.test(lead.phone)||lead.phone.replace(/\D/g,'').length<7||lead.phone.replace(/\D/g,'').length>15)fail('Укажите телефон — от 7 до 15 цифр.')
 if(lead.propertyId&&!/^p[\w-]{1,70}$/.test(lead.propertyId))fail('Проверьте объект заявки.')
 if(!/^[\p{L}\p{N}_: .-]+$/u.test(lead.source)&&!lead.source.startsWith('service:'))fail('Некорректный источник заявки.')
 lead.answers={}
 if(data.answers&&(typeof data.answers!=='object'||Array.isArray(data.answers)))fail('Проверьте ответы опроса.')
 if(data.answers){for(const [key,allowed]of [['choice',['new','resale','sell']],['district',['all','primorsky','center','arkadia']],['rooms',['all','2','3','4']]]){const value=data.answers[key];if(value!=null){if(!allowed.includes(value))fail('Проверьте ответы опроса.');lead.answers[key]=value}}}
 return lead
}
module.exports={validateLead}
