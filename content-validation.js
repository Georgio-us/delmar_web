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
    if(!['new','resale'].includes(p.kind)||!['primorsky','arkadia','center'].includes(p.district)) throw new Error('Выберите тип и район.')
    if(!Array.isArray(p.photos)||!p.photos.length||p.photos.length>8||p.photos.some(photo=>!safeAsset(photo))) throw new Error('Добавьте 1–8 фотографий: путь assets/, URL или загруженный файл.')
    if(p.pdf&&!(/^\/media\/[a-f0-9-]{36}\.pdf$/.test(p.pdf)||/^assets\/[\w./-]+\.pdf$/.test(p.pdf)&&!p.pdf.includes('..')||/^https?:\/\//i.test(p.pdf))) throw new Error('Проверьте ссылку на презентацию.')
  }
  if(!Array.isArray(state.editorial.exclusives)||!Array.isArray(state.editorial.top)||state.editorial.exclusives.length!==3||state.editorial.top.length!==3) throw new Error('В каждой подборке должно быть три места.')
  for(const slot of state.editorial.exclusives){
    if(!slot||typeof slot!=='object')throw new Error('Некорректный эксклюзив.')
    if(slot.propertyId!==null&&!ids.has(slot.propertyId)) throw new Error('Эксклюзив ссылается на удалённый объект.')
    for(const [key,max]of [['title',120],['description',280],['feature',50],['caption',50]]) if(typeof slot[key]!=='string'||slot[key].length>max) throw new Error('Текст эксклюзива слишком длинный. Заголовок — до 120, описание — до 280 символов.')
    if(slot.propertyId&&!slot.title.trim())throw new Error('Укажите заголовок эксклюзива.')
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
      if(!Array.isArray(entry.editorial.top)||entry.editorial.top.length!==3||!Array.isArray(entry.editorial.exclusives)||entry.editorial.exclusives.length!==3)throw new Error('Некорректные подборки в корзине.')
      validateContent({version:1,properties:[entry.property],editorial:{top:[null,null,null],exclusives:entry.editorial.exclusives.map(slot=>({...slot,propertyId:null}))}})
      validateContent({version:1,properties:[entry.property],editorial:{top:[null,null,null],exclusives:Array.from({length:3},()=>({propertyId:null,title:'',description:'',feature:'',caption:'',facts:['','']}))}})
    }
  }
  return state
}

if(typeof module !== 'undefined' && module.exports) module.exports={safeAsset,validateContent};
