// Local repository boundary. Replace this adapter with authenticated API calls later.
const contentStorageKey = 'delmar-content-v1'
const catalogTemplate = document.querySelector('.catalog-card').cloneNode(true)
const topTemplate = document.querySelector('.top-card').cloneNode(true)
const seedMetadata = new Map([...document.querySelectorAll('.catalog-card')].map(card => [card.dataset.property,{...card.dataset}]))
const defaultEditorial = {
  exclusives: [
    {propertyId:'p005',title:'Пентхаус с террасой\nи видом на море',description:'Просторная гостиная, открытая терраса и панорамные окна с видом на побережье',feature:'Терраса',caption:'открытая',facts:['45 м² терраса','Вид на море']},
    {propertyId:'p003',title:'Квартира у моря',description:'Квартира в Аркадии — предложение из демонстрационного каталога DELMAR',feature:'У моря',caption:'расположение',facts:['95 м² площадь','Аркадия']},
    {propertyId:'p002',title:'Квартира в центре\nОдессы',description:'Квартира с высокими потолками — предложение из демонстрационного каталога DELMAR',feature:'В центре',caption:'расположение',facts:['112 м² площадь','Центр Одессы']}
  ], top:['p003','p005','p001']
}
const seededProperties = propertyInventory.map(property=>({...property,...Object.fromEntries(['district','developer','tags','goals'].map(key=>[key,seedMetadata.get(property.id)?.[key]||''])),kind:seedMetadata.get(property.id)?.type||'resale'}))
function safeAsset(value) {
  if (typeof value !== 'string' || !value.trim()) return false
  return /^assets\/[\w./-]+$/.test(value) && !value.includes('..') || /^https?:\/\//i.test(value) || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)
}
function validateContent(state) {
  if (!state || state.version!==1 || !Array.isArray(state.properties) || !state.editorial) throw new Error('Некорректный формат данных.')
  const ids=new Set()
  if(state.properties.length>500) throw new Error('Не более 500 объектов в локальном прототипе.')
  for(const p of state.properties){
    if(!/^p[\w-]{1,70}$/.test(p.id)||ids.has(p.id)) throw new Error('Некорректный или повторяющийся ID объекта.')
    ids.add(p.id)
    for(const key of ['title','location','description','type','district','kind','tags','goals','developer']) if(typeof p[key]!=='string') throw new Error('Заполните данные объекта.')
    if(!p.title.trim()||p.title.length>160||!p.location.trim()||p.description.length>10000) throw new Error('Проверьте название, адрес и описание.')
    if(!Number.isFinite(p.price)||p.price<=0||!Number.isFinite(p.area)||p.area<=0||!Number.isInteger(p.rooms)||p.rooms<1||p.rooms>20) throw new Error('Укажите положительные цену и площадь; комнаты — от 1 до 20.')
    if(!['new','resale'].includes(p.kind)||!['primorsky','arkadia','center'].includes(p.district)) throw new Error('Выберите тип и район.')
    if(!Array.isArray(p.photos)||!p.photos.length||p.photos.length>8||p.photos.some(photo=>!safeAsset(photo))) throw new Error('Добавьте 1–8 фотографий: путь assets/, URL или загруженный файл.')
    if(p.pdf&&!(/^assets\/[\w./-]+\.pdf$/.test(p.pdf)&&!p.pdf.includes('..')||/^https?:\/\//i.test(p.pdf))) throw new Error('Проверьте ссылку на презентацию.')
  }
  if(state.editorial.exclusives.length!==3||state.editorial.top.length!==3) throw new Error('В каждой подборке должно быть три места.')
  for(const slot of state.editorial.exclusives){
    if(slot.propertyId!==null&&!ids.has(slot.propertyId)) throw new Error('Эксклюзив ссылается на удалённый объект.')
    for(const [key,max]of [['title',120],['description',280],['feature',50],['caption',50]]) if(typeof slot[key]!=='string'||slot[key].length>max) throw new Error('Текст эксклюзива слишком длинный. Заголовок — до 120, описание — до 280 символов.')
    if(slot.propertyId&&!slot.title.trim())throw new Error('Укажите заголовок эксклюзива.')
    if(!Array.isArray(slot.facts)||slot.facts.length!==2||slot.facts.some(x=>typeof x!=='string'||x.length>100)) throw new Error('Проверьте подписи на фотографии.')
  }
  if(state.editorial.top.some(id=>id!==null&&!ids.has(id))) throw new Error('Топ-3 ссылается на удалённый объект.')
  for(const list of [state.editorial.top,state.editorial.exclusives.map(x=>x.propertyId)]){const values=list.filter(Boolean);if(new Set(values).size!==values.length)throw new Error('В подборке каждый объект должен встречаться один раз.')}
  return state
}
let contentState={version:1,properties:seededProperties,editorial:structuredClone(defaultEditorial)}
let contentLoadError='',hasSavedContent=false
try {const saved=localStorage.getItem(contentStorageKey);if(saved){contentState=validateContent(JSON.parse(saved));hasSavedContent=true}}catch(error){contentLoadError='Сохранённые данные не удалось прочитать. Исходный каталог доступен; экспортируйте резервную копию перед дальнейшими изменениями.'}
const ContentRepository = {
  getSnapshot:()=>structuredClone(contentState),
  save(next){validateContent(next);const serialized=JSON.stringify(next);localStorage.setItem(contentStorageKey,serialized);contentState=structuredClone(next);propertyInventory.splice(0,propertyInventory.length,...contentState.properties);renderContentCards();document.dispatchEvent(new CustomEvent('delmar:content-changed'));},
  loadError:contentLoadError
}
propertyInventory.splice(0,propertyInventory.length,...contentState.properties)
function renderContentCards(){
  const grid=document.querySelector('#catalog-grid');grid.replaceChildren()
  for(const p of propertyInventory){
    const card=catalogTemplate.cloneNode(true);card.hidden=false;delete card.dataset.demo
    Object.assign(card.dataset,{property:p.id,price:p.price,type:p.kind,district:p.district,developer:p.developer,rooms:p.rooms,area:p.area,tags:p.tags,goals:p.goals})
    card.querySelector('img').src=p.photos[0];card.querySelector('img').alt=p.title
    card.querySelector('.property-open').dataset.openProperty=p.id;card.querySelector('.property-open').textContent=p.title
    card.querySelector('div>span').textContent=p.type+' · '+p.location
    card.querySelector('b').textContent='$'+new Intl.NumberFormat('ru-RU').format(p.price)
    card.querySelector('p').textContent=`${p.area} м² · ${p.rooms} комнаты`
    grid.append(card)
  }
  const top=document.querySelector('.top-grid');top.replaceChildren()
  contentState.editorial.top.forEach((id,index)=>{
    const p=propertyInventory.find(p=>p.id===id);if(!p)return
    const card=topTemplate.cloneNode(true);card.querySelector('img').src=p.photos[0];card.querySelector('img').alt=p.title
    card.querySelector('.top-rank').textContent=String(index+1).padStart(2,'0')
    card.querySelector('.property-open').textContent=p.title;card.querySelector('.property-open').dataset.openProperty=p.id
    card.querySelector('p').textContent=`${p.location} · ${p.area} м² · ${p.rooms} комнаты`
    card.querySelector('b').textContent='$'+new Intl.NumberFormat('ru-RU').format(p.price);top.append(card)
  })
  document.querySelector('#top-properties').hidden=!top.children.length
}
// Preserve accepted seed image framing until the first content edit.
if(hasSavedContent)renderContentCards()
