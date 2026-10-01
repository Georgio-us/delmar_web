// Shared content adapter: authenticated same-origin API, PostgreSQL persistence.
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
let contentState={version:1,properties:seededProperties,editorial:structuredClone(defaultEditorial)}
contentState=normalizeEditorialContent(contentState)
let contentRevision=0
let activeTopCategory='all'
async function contentRequest(path,options={}){
  const response=await fetch(path,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json','X-Delmar-Editor':'1',...options.headers},signal:AbortSignal.timeout(15000)})
  if(response.status===304)return null
  const data=await response.json()
  if(!response.ok){const error=new Error(data.error||'Не удалось выполнить запрос.');error.status=response.status;error.code=data.code;throw error}
  return data
}
function applyRemoteContent(result){
  validateContent(result.state);contentState=normalizeEditorialContent(result.state);contentRevision=result.revision
  propertyInventory.splice(0,propertyInventory.length,...contentState.properties);renderContentCards();document.dispatchEvent(new CustomEvent('delmar:content-changed'))
}
const ContentRepository={
  config:{serverAvailable:false,database:false,editorEnabled:false,authenticated:false},
  loadError:'',
  getSnapshot:()=>structuredClone(contentState),
  request:contentRequest,
  async connect(){
    try{
      const [config,result,session]=await Promise.all([contentRequest('/api/config'),contentRequest('/api/content'),contentRequest('/api/session')])
      Object.assign(this.config,config,{serverAvailable:true,authenticated:session.authenticated})
      if(session.authenticated)applyRemoteContent(await contentRequest('/api/editor/content'));else applyRemoteContent(result)
    }catch{this.config.authenticated=false;this.config.editorEnabled=false;this.loadError='Серверное хранение недоступно. Каталог показан без возможности редактирования.'}
  },
  async loadEditor(){applyRemoteContent(await contentRequest('/api/editor/content'))},
  async refreshPublic(){if(!this.config.serverAvailable||this.config.authenticated)return;try{const result=await contentRequest('/api/content',{headers:{'If-None-Match':`"${contentRevision}"`}});if(result)applyRemoteContent(result)}catch{}},
  async save(next){
    validateContent(next)
    if(!this.config.editorEnabled)throw new Error('Вход и база данных ещё не настроены на сервере.')
    const result=await contentRequest('/api/editor/content',{method:'PUT',body:JSON.stringify({state:next,revision:contentRevision})})
    applyRemoteContent(result)
  }
}
propertyInventory.splice(0,propertyInventory.length,...contentState.properties)
function renderContentCards(){
  const grid=document.querySelector('#catalog-grid');grid.replaceChildren()
  for(const p of propertyInventory){
    const card=catalogTemplate.cloneNode(true);card.hidden=false;delete card.dataset.demo
    Object.assign(card.dataset,{property:p.id,price:p.price,type:p.kind,district:p.district,developer:p.developer,rooms:p.rooms,area:p.area,tags:p.tags,goals:p.goals})
    card.querySelector('img').src=p.photos[0]||'assets/property-placeholder.svg';card.querySelector('img').alt=p.title
    card.querySelector('.property-open').dataset.openProperty=p.id;card.querySelector('.property-open').textContent=p.title
    card.querySelector('div>span').textContent=p.type+' · '+p.location
    card.querySelector('b').textContent='$'+new Intl.NumberFormat('ru-RU').format(p.price)
    card.querySelector('p').textContent=`${p.area} м² · ${p.rooms} комн.`
    addPropertyTags(card,p);grid.append(card)
  }
  renderTopCards()
}
function renderTopCards(){
  const top=document.querySelector('.top-grid');top.replaceChildren()
  const selected=(contentState.editorial.collections[activeTopCategory]||[]).map(id=>propertyInventory.find(p=>p.id===id)).filter(p=>p&&matchesCollection(p,activeTopCategory))
  const heading=document.querySelector('#top-title');heading.textContent=collectionLabels[activeTopCategory]
  selected.forEach((p,index)=>{
    const card=topTemplate.cloneNode(true);card.querySelector('img').src=p.photos[0]||'assets/property-placeholder.svg';card.querySelector('img').alt=p.title
    card.querySelector('.top-rank').textContent=String(index+1).padStart(2,'0')
    card.querySelector('.property-open').textContent=p.title;card.querySelector('.property-open').dataset.openProperty=p.id
    card.querySelector('p').textContent=`${p.location} · ${p.area} м² · ${p.rooms} комн.`
    card.querySelector('b').textContent='$'+new Intl.NumberFormat('ru-RU').format(p.price);addPropertyTags(card,p);top.append(card)
  })
  document.querySelector('#top-properties').hidden=!top.children.length&&!ContentRepository.config.authenticated
  document.querySelector('#top-empty').hidden=selected.length>0
  document.querySelectorAll('[data-category]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.category===activeTopCategory)))
}

ContentRepository.ready=ContentRepository.connect()

function propertyIcon(key){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('class','icon');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',propertyIcons[key]||propertyIcons.home);svg.append(path);return svg}
function addPropertyTags(card,p){
 card.querySelectorAll('.favorite,.property-tags').forEach(node=>node.remove())
 const tags=document.createElement('aside');tags.className='property-tags'
 const code=document.createElement('span');code.textContent=propertyCode(p);tags.append(code)
 if(contentState.editorial.exclusives.some(slot=>slot.propertyId===p.id)){const tag=document.createElement('span');tag.textContent='Эксклюзив';tags.append(tag)}
 card.append(tags)
}
