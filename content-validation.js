const collectionLabels={all:'Рекомендуем посмотреть',new:'Топ-3 новостройки',resale:'Топ-3 готовые квартиры',sea:'Топ-3 квартиры у моря',family:'Топ-3 для семьи',center:'Топ-3 в центре Одессы'}
const propertyIcons={
 area:'M4 10V4h6M14 4h6v6M20 14v6h-6M10 20H4v-6M4 4l6 6m10-6-6 6m6 10-6-6M4 20l6-6',
 rooms:'M3 20V8m18 12V8M3 15h18v4H3zM5 11h6v4H3v-2a2 2 0 0 1 2-2Zm9 0h5a2 2 0 0 1 2 2v2h-9z',
 baths:'M3 12h18v3a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5zM5 12V5a2 2 0 0 1 4 0v2M9 7h3M6 20v2m12-2v2',
 floor:'M5 21V3h14v18M3 21h18M9 7h6M9 11h6M9 15h6',
 terrace:'M3 11h18M12 3c-5 0-9 3-9 8h18c0-5-4-8-9-8Zm0 8v10M5 21V17h14v4M3 21h18',
 sea:'M2 8c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2M2 14c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2',
 parking:'M5 21V3h8a6 6 0 0 1 0 12H5M9 7h4a2 2 0 0 1 0 4H9z',
 price:'M12 2v20M17 6H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H6',
 pin:'M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0ZM10 10a2 2 0 1 0 4 0 2 2 0 1 0-4 0',
 home:'m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z'
}
const propertyIconLabels={area:'Площадь',rooms:'Комнаты',baths:'Ванные',floor:'Этаж',terrace:'Терраса',sea:'Море',parking:'Парковка',price:'Цена',pin:'Расположение',home:'Дом'}
function propertyCode(property){return 'D'+property.id.slice(1).padStart(3,'0')}
function matchesCollection(p,key){return key==='all'||key==='new'||key==='resale'?key==='all'||p.kind===key:key==='center'?p.district==='center':p.tags.split(' ').includes(key)}
function defaultExclusiveDisplay(slot){return {cover:0,stats:[{icon:'area',source:'area',text:'',label:'площадь'},{icon:'rooms',source:'rooms',text:'',label:'комнаты'},{icon:slot.propertyId==='p005'?'terrace':'pin',source:'custom',text:slot.feature||'',label:slot.caption||''}],photoFacts:[{icon:'terrace',source:'custom',text:slot.facts?.[0]||'',label:''},{icon:'sea',source:'custom',text:slot.facts?.[1]||'',label:''}]}}
function normalizeEditorialContent(state){
 const result=structuredClone(state),e=result.editorial
 if(!e.collections){e.collections=Object.fromEntries(Object.keys(collectionLabels).map(key=>[key,(e.top||[]).filter(id=>{const p=result.properties.find(p=>p.id===id);return p&&matchesCollection(p,key)})]))}
 e.top=[...(e.collections.all||[])];while(e.top.length<3)e.top.push(null)
 e.exclusives=e.exclusives.filter(slot=>slot.propertyId).map(slot=>({...slot,display:slot.display||defaultExclusiveDisplay(slot)}))
 return result
}
function displayFeatureValue(p,feature){
 if(feature.source==='custom')return feature.text
 if(feature.source==='price')return '$'+new Intl.NumberFormat('ru-RU').format(p.price)
 if(feature.source==='area')return p.area+' м²'
 if(feature.source==='rooms')return p.rooms+' комн.'
 if(feature.source==='terrace')return p.terraceArea?p.terraceArea+' м²':'Терраса'
 if(feature.source==='sea')return 'Вид на море'
 if(feature.source==='floor')return p.floor==null?'Этаж не указан':String(p.floor)+' этаж'
 if(feature.source==='baths')return p.baths==null?'Ванные не указаны':String(p.baths)+' ванн.'
 if(feature.source==='location')return p.location
 return ''
}
function safeAsset(value) {
  if (typeof value !== 'string' || !value.trim()) return false
  return /^\/media\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(value) || /^assets\/[\w./-]+$/.test(value) && !value.includes('..') || /^https?:\/\//i.test(value) || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)
}
function validateContent(state) {
  if (!state || state.version!==1 || !Array.isArray(state.properties) || !state.editorial) throw new Error('Некорректный формат данных.')
  const ids=new Set()
  if(state.properties.length>500) throw new Error('Не более 500 объектов в каталоге.')
  for(const p of state.properties){
    if(!p||typeof p!=='object'||!/^p[\w-]{1,70}$/.test(p.id)||ids.has(p.id)) throw new Error('Некорректный или повторяющийся ID объекта.')
    ids.add(p.id)
    for(const key of ['title','location','description','type','district','kind','tags','goals','developer']) if(typeof p[key]!=='string') throw new Error('Заполните данные объекта.')
    if(!p.title.trim()||p.title.length>160||!p.location.trim()||p.description.length>10000) throw new Error('Проверьте название, адрес и описание.')
    if(!Number.isFinite(p.price)||p.price<=0||!Number.isFinite(p.area)||p.area<=0||!Number.isInteger(p.rooms)||p.rooms<1||p.rooms>20) throw new Error('Укажите положительные цену и площадь; комнаты — от 1 до 20.')
    if(!['new','resale'].includes(p.kind)||!['primorsky','arkadia','center','khadzhybeysky','kyivsky','peresypsky'].includes(p.district)) throw new Error('Выберите тип и район.')
    if(!Array.isArray(p.photos)||p.photos.length>8||p.photos.some(photo=>!safeAsset(photo))) throw new Error('Добавьте до 8 фотографий: путь assets/, URL или загруженный файл.')
    if(p.pdf&&!(/^\/media\/[a-f0-9-]{36}\.pdf$/.test(p.pdf)||/^assets\/[\w./-]+\.pdf$/.test(p.pdf)&&!p.pdf.includes('..')||/^https?:\/\//i.test(p.pdf))) throw new Error('Проверьте ссылку на презентацию.')
    for(const key of ['floor','baths','terraceArea'])if(p[key]!=null&&(!Number.isFinite(p[key])||p[key]<0||p[key]>(key==='floor'?200:key==='baths'?20:10000)||(key!=='terraceArea'&&!Number.isInteger(p[key]))))throw new Error('Проверьте этаж, ванные и площадь террасы.')
  }
  if(!Array.isArray(state.editorial.exclusives)||!Array.isArray(state.editorial.top)||state.editorial.exclusives.length>20||state.editorial.top.length!==3) throw new Error('Проверьте редакционные подборки.')
  if(state.editorial.collections){
    for(const key of Object.keys(collectionLabels)){
      const list=state.editorial.collections[key]
      if(!Array.isArray(list)||list.length>3||list.some(id=>!ids.has(id))||new Set(list).size!==list.length)throw new Error('В подборке можно выбрать до трёх разных объектов.')
      if(list.some(id=>!matchesCollection(state.properties.find(p=>p.id===id),key)))throw new Error('Объект не соответствует выбранной категории подборки.')
    }
    if(JSON.stringify(state.editorial.top.filter(Boolean))!==JSON.stringify(state.editorial.collections.all))throw new Error('Общая подборка не совпадает с рекомендациями.')
  }
  for(const slot of state.editorial.exclusives){
    if(!slot||typeof slot!=='object')throw new Error('Некорректный эксклюзив.')
    if(slot.propertyId!==null&&!ids.has(slot.propertyId)) throw new Error('Эксклюзив ссылается на удалённый объект.')
    for(const [key,max]of [['title',120],['description',280],['feature',50],['caption',50]]) if(typeof slot[key]!=='string'||slot[key].length>max) throw new Error('Текст эксклюзива слишком длинный. Заголовок — до 120, описание — до 280 символов.')
    if(slot.propertyId&&!slot.title.trim())throw new Error('Укажите заголовок эксклюзива.')
    if(slot.display){
      if(!Number.isInteger(slot.display.cover)||slot.display.cover<0||slot.display.cover>7)throw new Error('Выберите фотографию обложки.')
      for(const [key,length]of [['stats',3],['photoFacts',2]]){
        const list=slot.display[key]
        if(!Array.isArray(list)||list.length!==length||list.some(f=>!f||!propertyIcons[f.icon]||!['custom','area','rooms','price','floor','baths','terrace','sea','location'].includes(f.source)||typeof f.text!=='string'||f.text.length>100||typeof f.label!=='string'||f.label.length>50))throw new Error('Проверьте характеристики и иконки эксклюзива.')
      }
    }
    if(!Array.isArray(slot.facts)||slot.facts.length!==2||slot.facts.some(x=>typeof x!=='string'||x.length>100)) throw new Error('Проверьте подписи на фотографии.')
  }
  if(state.editorial.top.some(id=>id!==null&&!ids.has(id))) throw new Error('Топ-3 ссылается на удалённый объект.')
  for(const list of [state.editorial.top,state.editorial.exclusives.map(x=>x.propertyId)]){const values=list.filter(Boolean);if(new Set(values).size!==values.length)throw new Error('В подборке каждый объект должен встречаться один раз.')}
  if(state.trash!==undefined){
    if(!Array.isArray(state.trash)||state.trash.length>500)throw new Error('Некорректная корзина: не более 500 записей.')
    const archivedIds=new Set()
    for(const entry of state.trash){
      if(!entry||!entry.property||!entry.editorial)throw new Error('Некорректная запись корзины.')
      if(ids.has(entry.property.id)||archivedIds.has(entry.property.id))throw new Error('Повтор ID в корзине.')
      archivedIds.add(entry.property.id)
      if(!Array.isArray(entry.editorial.top)||entry.editorial.top.length!==3||!Array.isArray(entry.editorial.exclusives)||entry.editorial.exclusives.length>20)throw new Error('Некорректные подборки в корзине.')
      validateContent({version:1,properties:[entry.property],editorial:{top:[null,null,null],exclusives:entry.editorial.exclusives.map(slot=>({...slot,propertyId:null}))}})
      validateContent({version:1,properties:[entry.property],editorial:{top:[null,null,null],exclusives:Array.from({length:3},()=>({propertyId:null,title:'',description:'',feature:'',caption:'',facts:['','']}))}})
    }
  }
  return state
}

if(typeof module !== 'undefined' && module.exports) module.exports={safeAsset,validateContent,normalizeEditorialContent,matchesCollection,propertyCode,displayFeatureValue};
