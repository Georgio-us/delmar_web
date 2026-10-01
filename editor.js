// The server owns credentials and sessions; no password or auth token is kept in browser storage.
const EditorSession={
  isActive(){return ContentRepository.config.authenticated},
  async signIn(login,password){
    try{await ContentRepository.request('/api/login',{method:'POST',body:JSON.stringify({login,password})});ContentRepository.config.authenticated=true;await ContentRepository.loadEditor();return true}catch(error){ContentRepository.config.authenticated=false;if(error.status===401)return false;throw error}
  },
  async signOut(){await ContentRepository.request('/api/logout',{method:'POST',body:'{}'});ContentRepository.config.authenticated=false;await ContentRepository.refreshPublic()}
}
const editorRoot=document.createElement('dialog');editorRoot.className='editor-dialog';editorRoot.id='editor-dialog';editorRoot.setAttribute('aria-labelledby','editor-title');editorRoot.dataset.noI18n=''
editorRoot.innerHTML=`<div class="editor-heading"><div><span class="eyebrow">DELMAR · РЕДАКТОР</span><h2 id="editor-title"></h2></div><button type="button" class="editor-close" aria-label="Закрыть редактор"><svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div><div id="editor-content"></div><p id="editor-status" role="status"></p>`
document.body.append(editorRoot)
const editorToolbar=document.createElement('div');editorToolbar.className='editor-toolbar';editorToolbar.dataset.noI18n='';editorToolbar.hidden=true
editorToolbar.innerHTML='<span>Режим редактора <small>Сохранение на сервере</small></span><button type="button" data-editor-view="objects">Объекты</button><button type="button" data-editor-view="exclusives">Эксклюзивы</button><button type="button" data-editor-view="top">Подборки</button><button type="button" id="editor-logout">Выйти</button>'
document.body.append(editorToolbar)
let editorPreviousOverflow='',editorActive=EditorSession.isActive(),editorCurrentView='objects',editorSearch=''
function editorNotice(message){document.querySelector('#editor-status').textContent=message}
function editorOpen(title){
  document.querySelector('#editor-title').textContent=title;editorNotice('')
  if(!editorRoot.open){editorPreviousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';editorRoot.showModal()}
  editorRoot.scrollTop=0
}
editorRoot.querySelector('.editor-close').addEventListener('click',()=>editorRoot.close())
editorRoot.addEventListener('close',()=>{document.body.style.overflow=editorPreviousOverflow})
editorRoot.addEventListener('click',event=>{const r=editorRoot.getBoundingClientRect();if(event.target===editorRoot&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))editorRoot.close()})
const editorContent=editorRoot.querySelector('#editor-content')
function editorButton(label,action,className='editor-button'){const button=document.createElement('button');button.type='button';button.className=className;button.textContent=label;button.addEventListener('click',action);return button}
function editorField(parent,label,name,value='',type='text',options=null){
  const wrap=document.createElement('label');wrap.className='editor-field';const caption=document.createElement('span');caption.textContent=label;wrap.append(caption)
  let input
  if(options){
    input=document.createElement('input');input.type='hidden';input.name=name;input.value=value
    const trigger=editorButton(options.find(item=>item[0]===value)?.[1]||'Выберите',()=>{list.hidden=!list.hidden;trigger.setAttribute('aria-expanded',String(!list.hidden))},'editor-select-trigger');trigger.setAttribute('aria-label',label);trigger.setAttribute('aria-expanded','false')
    const list=document.createElement('div');list.className='editor-select-options';list.hidden=true
    for(const [key,text]of options){const button=editorButton(text,()=>{input.value=key;trigger.textContent=text;list.hidden=true;trigger.setAttribute('aria-expanded','false');input.dispatchEvent(new Event('change',{bubbles:true}))});list.append(button)}
    list.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();list.hidden=true;trigger.setAttribute('aria-expanded','false');trigger.focus()}})
    wrap.append(input,trigger,list)
  }else{
    input=document.createElement(type==='textarea'?'textarea':'input');input.name=name;if(type!=='textarea')input.type=type;input.value=value
    if(type==='number'){input.min=['floor','baths','terraceArea'].includes(name)?'0':'1';input.step=['rooms','floor','baths'].includes(name)?'1':'any'}
    if(type==='textarea')input.rows=3
    wrap.append(input)
  }
  parent.append(wrap);return input

}
function editorChoices(parent,label,name,value,options){
  const field=document.createElement('fieldset');field.className='editor-choices';const legend=document.createElement('legend');legend.textContent=label;field.append(legend)
  for(const [key,text]of options){const item=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.name=name;input.value=key;input.checked=value.split(' ').includes(key);const span=document.createElement('span');span.textContent=text;item.append(input,span);field.append(item)}
  parent.append(field)
}
function syncEditorUI(){
  document.body.classList.toggle('editor-active',editorActive);editorToolbar.hidden=!editorActive
  document.querySelector('#editor-entry').textContent=editorActive?'Редактировать сайт':'Вход для редактора'
  document.querySelectorAll('.editor-inline,.editor-category-edit').forEach(button=>button.remove())
  document.querySelector('#featured').hidden=!exclusiveItems.length&&!editorActive
  document.querySelector('#top-properties').hidden=!document.querySelector('.top-grid .top-card')&&!editorActive
  if(!editorActive){document.querySelectorAll('.editor-selection-item').forEach(wrap=>wrap.replaceWith(wrap.querySelector('[data-category]')));return}
  document.querySelector('#featured').hidden=false
  const featured=document.querySelector('.featured-panel')
  featured.querySelector('.editor-empty-message')?.remove()
  if(!exclusiveItems.length){const message=document.createElement('p');message.className='editor-empty-message';message.textContent='Эксклюзивов пока нет. Добавьте объект из каталога.';featured.append(message)}
  featured.prepend(editorButton(exclusiveItems.length?'Редактировать этот эксклюзив':'Добавить эксклюзив',()=>exclusiveItems.length?editExclusiveInline(exclusiveItems[exclusiveIndex].propertyId):showExclusiveList(),'editor-inline'))
  const catalog=document.querySelector('.catalog-panel');catalog.prepend(editorButton('Объекты',showObjectList,'editor-inline'))
  document.querySelectorAll('[data-category]').forEach(button=>{const edit=editorButton('Настроить подборку',()=>showCollectionEditor(button.dataset.category),'editor-category-edit');edit.setAttribute('aria-label','Настроить подборку: '+button.textContent.trim());let wrap=button.parentElement;if(!wrap.classList.contains('editor-selection-item')){wrap=document.createElement('div');wrap.className='editor-selection-item';button.before(wrap);wrap.append(button)}wrap.append(edit)})
  document.querySelectorAll('.catalog-card,.top-card').forEach(card=>{const id=card.dataset.property||card.querySelector('[data-open-property]').dataset.openProperty;card.append(editorButton('Изменить объект',()=>showPropertyEditor(id),'editor-inline editor-card-edit'))})
}
function showEditorLogin(){
  editorContent.innerHTML='<p class="editor-intro">Войдите с логином и паролем редактора. Изменения сохраняются на сервере и доступны всем посетителям.</p><form id="editor-login" novalidate><div class="editor-fields"></div><button class="editor-button editor-primary" type="submit">Войти</button></form>'
  const form=editorContent.querySelector('form'),fields=form.querySelector('.editor-fields')
  const login=editorField(fields,'Логин','login'),password=editorField(fields,'Пароль','password','','password');login.autocomplete='username';password.autocomplete='current-password'
  form.addEventListener('submit',async event=>{event.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;try{if(!await EditorSession.signIn(login.value.trim(),password.value)){editorNotice('Неверный логин или пароль. Проверьте раскладку клавиатуры и повторите вход.');password.setAttribute('aria-invalid','true');return}password.value='';editorActive=true;syncEditorUI();showEditorView('objects')}catch(error){editorNotice(error.message)}finally{button.disabled=false}})
  editorOpen('Вход для редактора')
  if(!ContentRepository.config.editorEnabled)editorNotice('Вход ещё не настроен. Необходимы база данных и данные редактора в настройках сервера.')
}
function showEditorView(view){
  if(!editorActive){showEditorLogin();return}
  editorCurrentView=view
  if(view==='objects')showObjectList();else if(view==='exclusives')showExclusiveList();else showCollectionEditor(activeTopCategory)
}
function showObjectList(){
  editorContent.innerHTML='<p class="editor-intro">Каталог объектов. Все подборки используют эти же записи.</p><div class="editor-list-tools"></div><div class="editor-object-list"></div>'
  const tools=editorContent.querySelector('.editor-list-tools')
  const search=document.createElement('input');search.type='search';search.placeholder='Найти объект';search.setAttribute('aria-label','Найти объект');search.value=editorSearch;tools.append(search)
  tools.append(editorButton('Добавить объект',()=>showPropertyEditor(null),'editor-button editor-primary'))
  if(ContentRepository.getSnapshot().trash?.length)tools.append(editorButton('Восстановить последний удалённый',restoreEditorProperty))
  function list(){
    const container=editorContent.querySelector('.editor-object-list');container.replaceChildren()
    const state=ContentRepository.getSnapshot();const found=state.properties.filter(p=>(p.title+' '+p.location+' '+p.id+' '+propertyCode(p)).toLowerCase().includes(search.value.toLowerCase()))
    if(!found.length){const p=document.createElement('p');p.textContent='Объекты не найдены.';container.append(p)}
    for(const property of found){
      const row=document.createElement('div');row.className='editor-object-row'
      const image=document.createElement('img');image.src=property.photos[0]||'assets/property-placeholder.svg';image.alt='';const text=document.createElement('div');const title=document.createElement('b');title.textContent=propertyCode(property)+' · '+property.title;const detail=document.createElement('small');detail.textContent=`${property.location} · ${formatPropertyPrice(property.price)}`;text.append(title,detail)
      const actions=document.createElement('div');actions.className='editor-row-actions';actions.append(editorButton('Изменить',()=>showPropertyEditor(property.id)),editorButton('Удалить',()=>showDeleteProperty(property.id),'editor-button editor-danger'));row.append(image,text,actions);container.append(row)
    }
  }
  search.addEventListener('input',()=>{editorSearch=search.value;list()});list();editorOpen('Объекты')
  if(ContentRepository.loadError)editorNotice(ContentRepository.loadError)
}
async function persistEditor(next,message){
  if(!editorActive){showEditorLogin();return false}
  const controls=[...editorRoot.querySelectorAll('button,input,textarea,select'),...editorToolbar.querySelectorAll('button')].map(control=>[control,control.disabled])
  controls.forEach(([control])=>control.disabled=true);editorNotice('Сохраняем изменения…')
  try{await ContentRepository.save(next);syncEditorUI();editorNotice(message);return true}catch(error){if(error.status===401){editorActive=false;ContentRepository.config.authenticated=false;syncEditorUI()}editorNotice(error.message||'Не удалось сохранить изменения.');return false}finally{controls.forEach(([control,disabled])=>control.disabled=disabled)}
}
function showPropertyEditor(id){
  const snapshot=ContentRepository.getSnapshot(),property=snapshot.properties.find(p=>p.id===id)||{title:'',location:'',price:'',area:'',rooms:1,kind:'new',district:'primorsky',developer:'',description:'',photos:[],tags:'',goals:'',pdf:''}
  editorContent.innerHTML='<button type="button" class="editor-back editor-button">К списку объектов</button><form id="editor-property-form" novalidate><div class="editor-fields"></div><div class="editor-photo-preview"></div><div class="editor-form-actions"><button class="editor-button editor-primary" type="submit">Сохранить объект</button></div></form>'
  editorContent.querySelector('.editor-back').addEventListener('click',showObjectList)
  const form=editorContent.querySelector('form'),fields=form.querySelector('.editor-fields')
  editorField(fields,'Название','title',property.title);editorField(fields,'Расположение','location',property.location)
  editorField(fields,'Цена, USD','price',property.price,'number');editorField(fields,'Площадь, м²','area',property.area,'number');editorField(fields,'Комнаты','rooms',property.rooms,'number')
  editorField(fields,'Этаж','floor',property.floor??'','number');editorField(fields,'Ванные комнаты','baths',property.baths??'','number');editorField(fields,'Площадь террасы, м²','terraceArea',property.terraceArea??'','number')
  editorField(fields,'Тип','kind',property.kind,'text',[['new','Новостройка'],['resale','Вторичная недвижимость']])
  editorField(fields,'Район','district',property.district,'text',[['primorsky','Приморский'],['khadzhybeysky','Хаджибеевский'],['kyivsky','Киевский'],['peresypsky','Пересыпский'],['arkadia','Аркадия'],['center','Центр Одессы']])
  const developers=[['','Без застройщика'],...document.querySelectorAll('.developer-card[data-developer]')].map(item=>Array.isArray(item)?item:[item.dataset.developer,item.querySelector('strong')?.textContent||item.dataset.developer])
  editorField(fields,'Застройщик','developer',property.developer,'text',developers)
  const description=editorField(fields,'Описание','description',property.description,'textarea');description.parentElement.classList.add('editor-wide')
  const photos=editorField(fields,'Фотографии — одна ссылка или путь assets/ на строку','photos',property.photos.join('\n'),'textarea');photos.parentElement.classList.add('editor-wide')
  const uploader=editorField(fields,'Загрузить фотографии — до 8, по 10 МБ','upload','','file');uploader.accept='image/jpeg,image/png,image/webp';uploader.multiple=true;uploader.parentElement.classList.add('editor-file-upload')
  const pdf=editorField(fields,'Ссылка на PDF — необязательно','pdf',property.pdf||'')
  const pdfUploader=editorField(fields,'Загрузить презентацию PDF — до 20 МБ','pdf-upload','','file');pdfUploader.accept='application/pdf';pdfUploader.parentElement.classList.add('editor-file-upload')
  const pdfStatus=document.createElement('p');pdfStatus.className='editor-upload-note';pdfStatus.textContent=pdf.value?'Презентация прикреплена. Можно заменить файл или удалить ссылку.':'PDF не прикреплён.';pdfUploader.parentElement.after(pdfStatus)
  let photoReadPending=false
  function preview(){
    const container=form.querySelector('.editor-photo-preview');container.replaceChildren()
    const sources=photos.value.split('\n').map(x=>x.trim()).filter(Boolean)
    sources.slice(0,8).forEach((src,index)=>{if(!safeAsset(src))return;const item=document.createElement('div'),image=document.createElement('img');image.src=src;image.alt='Фотография '+(index+1);item.append(image,editorButton('Убрать',()=>{sources.splice(index,1);photos.value=sources.join('\n');preview()},'editor-button editor-photo-remove'));item.querySelector('button').disabled=photoReadPending;container.append(item)})
  }
  photos.addEventListener('input',preview);preview()
  async function uploadFile(file){
    const response=await fetch('/api/editor/media',{method:'POST',credentials:'same-origin',headers:{'Content-Type':file.type,'X-Delmar-Editor':'1'},body:file,signal:AbortSignal.timeout(60000)})
    const result=await response.json();if(!response.ok)throw new Error(result.error||'Не удалось загрузить файл.');return result.url
  }
  async function uploading(action){
    if(photoReadPending)return
    if(!ContentRepository.config.mediaEnabled){editorNotice('Загрузка в R2 не настроена. Проверьте переменные сервиса сайта.');return}
    photoReadPending=true;const controls=[...form.querySelectorAll('button,input,textarea,select')].map(input=>[input,input.disabled]);controls.forEach(([input])=>input.disabled=true)
    try{await action()}catch(error){editorNotice(error.name==='TimeoutError'?'Время загрузки истекло. Повторите попытку.':error.message||'Не удалось загрузить файл.')}finally{photoReadPending=false;controls.forEach(([input,disabled])=>input.disabled=disabled);form.querySelectorAll('.editor-photo-remove').forEach(button=>button.disabled=false);uploader.value='';pdfUploader.value=''}
  }
  uploader.addEventListener('change',async()=>{
    const files=[...uploader.files];if(!files.length)return
    const existing=photos.value.split('\n').map(x=>x.trim()).filter(Boolean)
    if(existing.length+files.length>8||files.some(file=>file.size>10*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))){editorNotice('До 8 фотографий, по 10 МБ. При необходимости уберите старые фотографии.');uploader.value='';return}
    await uploading(async()=>{for(let i=0;i<files.length;i++){editorNotice('Загружаем фотографию '+(i+1)+' из '+files.length+'…');const url=await uploadFile(files[i]);existing.push(url);photos.value=existing.join('\n');preview()}editorNotice('Фотографии загружены в R2. Сохраните объект, чтобы опубликовать галерею.')})
  })
  pdfUploader.addEventListener('change',async()=>{
    const file=pdfUploader.files[0];if(!file)return
    if(file.type!=='application/pdf'||file.size>20*1024*1024){editorNotice('Выберите PDF не больше 20 МБ.');pdfUploader.value='';return}
    await uploading(async()=>{editorNotice('Загружаем PDF…');pdf.value=await uploadFile(file);pdfStatus.textContent='Прикреплено: '+file.name;editorNotice('PDF загружен в R2. Сохраните объект, чтобы прикрепить презентацию.')})
  })
  editorChoices(fields,'Особенности для подбора','tags',property.tags,[['sea','У моря'],['family','Для семьи'],['large','Просторные квартиры']])
  editorChoices(fields,'Цель покупки','goals',property.goals,[['life','Для жизни'],['investment','Для инвестиций']])
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(photoReadPending)return
    const data=new FormData(form),next=ContentRepository.getSnapshot()
    const updated={...property,id:id||'p'+String(Math.max(0,...next.properties.map(p=>/^p\d+$/.test(p.id)?Number(p.id.slice(1)):0),...(next.trash||[]).map(entry=>/^p\d+$/.test(entry.property.id)?Number(entry.property.id.slice(1)):0))+1).padStart(3,'0'),title:String(data.get('title')).trim(),location:String(data.get('location')).trim(),price:Number(data.get('price')),area:Number(data.get('area')),rooms:Number(data.get('rooms')),floor:data.get('floor')===''?null:Number(data.get('floor')),baths:data.get('baths')===''?null:Number(data.get('baths')),terraceArea:data.get('terraceArea')===''?null:Number(data.get('terraceArea')),kind:data.get('kind'),type:data.get('kind')==='new'?'Новостройка':'Вторичная недвижимость',district:data.get('district'),developer:data.get('developer'),description:String(data.get('description')).trim(),photos:String(data.get('photos')).split('\n').map(x=>x.trim()).filter(Boolean),tags:[...data.getAll('tags'),data.get('kind'),...(data.get('district')==='center'?['center']:[])].join(' '),goals:data.getAll('goals').join(' '),pdf:String(data.get('pdf')).trim()}
    const index=next.properties.findIndex(p=>p.id===id);if(index>=0)next.properties[index]=updated;else next.properties.unshift(updated)
    cleanCollections(next)
    if(await persistEditor(next,'Объект сохранён.')){showObjectList();editorNotice('Объект сохранён. Каталог и подборки обновлены.')}
  })
  editorOpen(id?'Редактировать объект':'Новый объект')
}
function showDeleteProperty(id){
  const state=ContentRepository.getSnapshot(),property=state.properties.find(p=>p.id===id);if(!property)return
  editorContent.replaceChildren();const copy=document.createElement('p');copy.className='editor-intro';copy.textContent=`Удалить «${property.title}» из каталога? Если объект входит в эксклюзивы или топ-3, соответствующее место останется пустым — его можно заполнить другим объектом.`
  editorContent.append(copy,editorButton('Отмена',showObjectList),editorButton('Удалить объект',async()=>{
    const next=ContentRepository.getSnapshot();next.trash=next.trash||[];next.trash.push({property:next.properties.find(p=>p.id===id),editorial:structuredClone(next.editorial)});next.properties=next.properties.filter(p=>p.id!==id);next.editorial.exclusives=next.editorial.exclusives.filter(slot=>slot.propertyId!==id);cleanCollections(next)
    if(await persistEditor(next,'Объект удалён.')){showObjectList();editorNotice('Объект удалён. Места в подборках освобождены.')}
  },'editor-button editor-danger'))
  editorOpen('Удалить объект')
}
async function restoreEditorProperty(){
  const next=ContentRepository.getSnapshot(),entry=next.trash?.pop();if(!entry)return
  next.properties.push(entry.property)
  for(const key of Object.keys(collectionLabels)){const previous=entry.editorial.collections?.[key]||(key==='all'?entry.editorial.top.filter(Boolean):[]);if(previous.includes(entry.property.id)&&next.editorial.collections[key].length<3)next.editorial.collections[key].splice(Math.min(previous.indexOf(entry.property.id),next.editorial.collections[key].length),0,entry.property.id)}
  const exclusive=entry.editorial.exclusives.find(slot=>slot.propertyId===entry.property.id);if(exclusive&&!next.editorial.exclusives.some(slot=>slot.propertyId===entry.property.id))next.editorial.exclusives.push({...exclusive,display:exclusive.display||defaultExclusiveDisplay(exclusive)})
  cleanCollections(next)
  if(await persistEditor(next,'Объект восстановлен.')){showObjectList();editorNotice('Объект восстановлен.')}
}
function cleanCollections(state){
 for(const key of Object.keys(collectionLabels))state.editorial.collections[key]=state.editorial.collections[key].filter(id=>{const p=state.properties.find(p=>p.id===id);return p&&matchesCollection(p,key)})
 state.editorial.top=[...state.editorial.collections.all];while(state.editorial.top.length<3)state.editorial.top.push(null)
}
function editorPropertyTile(p,action,label){
 const tile=document.createElement('div');tile.className='editor-picker-card'
 const image=document.createElement('img');image.src=p.photos[0]||'assets/property-placeholder.svg';image.alt=''
 const copy=document.createElement('div'),code=document.createElement('small'),title=document.createElement('strong'),detail=document.createElement('p');code.textContent=propertyCode(p);title.textContent=p.title;detail.textContent=formatPropertyPrice(p.price)+' · '+p.area+' м² · '+p.location;copy.append(code,title,detail)
 tile.append(image,copy,editorButton(label,action));return tile
}
function showCollectionEditor(category='all'){
 const state=ContentRepository.getSnapshot();let selected=[...state.editorial.collections[category]]
 editorContent.innerHTML='<p class="editor-intro">Выберите до трёх объектов и задайте порядок. Это рекомендации агентства для этой категории; каталог не меняется.</p><div class="editor-collection-tabs"></div><h3>Выбранные объекты</h3><div class="editor-selected"></div><div class="editor-list-tools"></div><div class="editor-picker-grid"></div><div class="editor-form-actions"></div>'
 for(const key of Object.keys(collectionLabels)){const button=editorButton(collectionLabels[key],()=>showCollectionEditor(key));button.setAttribute('aria-pressed',String(key===category));editorContent.querySelector('.editor-collection-tabs').append(button)}
 const search=document.createElement('input');search.type='search';search.placeholder='Название или ID, например D005';search.setAttribute('aria-label','Найти объект для подборки');editorContent.querySelector('.editor-list-tools').append(search)
 function render(){
  const chosen=editorContent.querySelector('.editor-selected');chosen.replaceChildren()
  if(!selected.length){const empty=document.createElement('p');empty.textContent='Ничего не выбрано. Пустая подборка скрыта от посетителей.';chosen.append(empty)}
  selected.forEach((id,index)=>{const p=state.properties.find(p=>p.id===id);const tile=editorPropertyTile(p,()=>{selected=selected.filter(value=>value!==id);render()},'Убрать');const controls=document.createElement('div');controls.className='editor-order';for(const [offset,label,path]of [[-1,'Поднять объект','m6 14 6-6 6 6'],[1,'Опустить объект','m6 10 6 6 6-6']]){const button=editorButton('',()=>{const target=index+offset;[selected[index],selected[target]]=[selected[target],selected[index]];render()});button.setAttribute('aria-label',label+' '+propertyCode(p));button.innerHTML='<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="'+path+'"/></svg>';button.disabled=index+offset<0||index+offset>=selected.length;controls.append(button)}tile.append(controls);chosen.append(tile)})
  const pool=editorContent.querySelector('.editor-picker-grid');pool.replaceChildren()
  const candidates=state.properties.filter(p=>matchesCollection(p,category)&&!selected.includes(p.id)&&(p.title+' '+propertyCode(p)).toLowerCase().includes(search.value.toLowerCase()))
  for(const p of candidates){const tile=editorPropertyTile(p,()=>{if(selected.length<3){selected.push(p.id);render()}},'Добавить');tile.querySelector('button').disabled=selected.length>=3;pool.append(tile)}
  if(!candidates.length){const empty=document.createElement('p');empty.textContent='Нет подходящих объектов. Добавьте объект или измените его характеристики.';pool.append(empty)}
 }
 search.addEventListener('input',render);render()
 editorContent.querySelector('.editor-form-actions').append(editorButton('Сохранить подборку',async()=>{const next=ContentRepository.getSnapshot();next.editorial.collections[category]=selected;cleanCollections(next);await persistEditor(next,'Подборка сохранена.')},'editor-button editor-primary'))
 editorOpen(collectionLabels[category])
}
function showExclusiveList(){
 const state=ContentRepository.getSnapshot();editorContent.innerHTML='<p class="editor-intro">Выберите объект из каталога. Его цену и характеристики не нужно заполнять повторно; оформление редактируется прямо в блоке эксклюзива.</p><div class="editor-list-tools"></div><div class="editor-selected"></div><h3>Добавить эксклюзив из объектов</h3><div class="editor-picker-grid"></div>'
 const search=document.createElement('input');search.type='search';search.setAttribute('aria-label','Найти объект для эксклюзива');search.placeholder='Название или ID';editorContent.querySelector('.editor-list-tools').append(search)
 state.editorial.exclusives.forEach(slot=>{const p=state.properties.find(p=>p.id===slot.propertyId);const tile=editorPropertyTile(p,()=>{editorRoot.close();editExclusiveInline(p.id)},'Оформить');tile.append(editorButton('Убрать из эксклюзивов',async()=>{const next=ContentRepository.getSnapshot();next.editorial.exclusives=next.editorial.exclusives.filter(value=>value.propertyId!==p.id);if(await persistEditor(next,'Эксклюзив убран. Объект остаётся в каталоге.'))showExclusiveList()}));editorContent.querySelector('.editor-selected').append(tile)})
 function render(){const pool=editorContent.querySelector('.editor-picker-grid');pool.replaceChildren();for(const p of state.properties.filter(p=>!state.editorial.exclusives.some(slot=>slot.propertyId===p.id)&&(p.title+' '+propertyCode(p)).toLowerCase().includes(search.value.toLowerCase()))){pool.append(editorPropertyTile(p,async()=>{const next=ContentRepository.getSnapshot();const slot={propertyId:p.id,title:p.title,description:p.description.slice(0,280),feature:'',caption:'',facts:['','']};slot.display=defaultExclusiveDisplay(slot);slot.display.stats[2]={icon:p.tags.split(' ').includes('sea')?'sea':'pin',source:p.tags.split(' ').includes('sea')?'sea':'location',text:'',label:'расположение'};slot.display.photoFacts=[{icon:'area',source:'area',text:'',label:''},{...slot.display.stats[2],label:''}];next.editorial.exclusives.push(slot);if(await persistEditor(next,'Эксклюзив добавлен.')){editorRoot.close();editExclusiveInline(p.id)}},'Добавить эксклюзив'))}if(!pool.children.length){const empty=document.createElement('p');empty.textContent='Нет объектов для добавления. Сначала создайте объект в каталоге.';pool.append(empty)}}
 search.addEventListener('input',render);render();editorOpen('Эксклюзивы')
}
function editExclusiveInline(id){
 if(!editorActive)return
 finishExclusiveInline()
 const state=ContentRepository.getSnapshot(),p=state.properties.find(p=>p.id===id),slot=structuredClone(state.editorial.exclusives.find(slot=>slot.propertyId===id));if(!slot)return
 exclusiveIndex=exclusiveItems.findIndex(item=>item.propertyId===id);renderExclusive()
 const panel=document.querySelector('.featured-panel'),copy=panel.querySelector('.featured-copy');copy.hidden=true
 panel.querySelectorAll('.editor-inline').forEach(button=>button.hidden=true)
 const form=document.createElement('form');form.className='exclusive-inline-form';form.dataset.noI18n='';form.noValidate=true
 const heading=document.createElement('h3');heading.textContent='Оформление эксклюзива · '+propertyCode(p);form.append(heading)
 const fields=document.createElement('div');fields.className='editor-fields';form.append(fields)
 const title=editorField(fields,'Заголовок в блоке','display-title',slot.title,'textarea'),description=editorField(fields,'Короткое описание','display-description',slot.description,'textarea')
 const cover=document.createElement('div');cover.className='editor-cover-choices';const coverLabel=document.createElement('p');coverLabel.textContent='Обложка: выберите фотографию объекта';form.append(coverLabel,cover)
 p.photos.forEach((src,index)=>{const button=editorButton('',()=>{slot.display.cover=index;previewDisplay()});button.setAttribute('aria-label','Обложка: фото '+(index+1));const image=document.createElement('img');image.src=src;image.alt='Фото '+(index+1);button.append(image);cover.append(button)})
 const sourceOptions=[['custom','Своя подпись'],['area','Площадь объекта'],['rooms','Комнаты'],['price','Цена объекта'],['floor','Этаж'],['baths','Ванные'],['terrace','Терраса'],['sea','Вид на море'],['location','Расположение']]
 for(const [key,label]of [['stats','Характеристики под заголовком'],['photoFacts','Подписи на фотографии']]){const h=document.createElement('h4');h.textContent=label;form.append(h);slot.display[key].forEach((feature,index)=>{const row=document.createElement('div');row.className='editor-feature-row';const result=document.createElement('p');result.className='editor-feature-preview';row.append(result);const palette=document.createElement('div');palette.className='editor-icon-palette';palette.setAttribute('aria-label',label+' '+(index+1));for(const icon of Object.keys(propertyIcons)){const button=editorButton('',()=>{feature.icon=icon;palette.querySelectorAll('button').forEach(item=>item.setAttribute('aria-pressed',String(item.dataset.icon===icon)));previewDisplay()});button.dataset.icon=icon;button.setAttribute('aria-label',propertyIconLabels[icon]);button.setAttribute('aria-pressed',String(feature.icon===icon));button.append(propertyIcon(icon));palette.append(button)}row.append(palette);const data=document.createElement('div');data.className='editor-fields';row.append(data);const source=editorField(data,'Значение '+(index+1),'source-'+key+index,feature.source,'text',sourceOptions),text=editorField(data,'Своя подпись '+(index+1),'text-'+key+index,feature.text),caption=editorField(data,'Пояснение '+(index+1),'label-'+key+index,feature.label);function update(){feature.source=source.value;feature.text=text.value;feature.label=caption.value;text.disabled=feature.source!=='custom';text.parentElement.hidden=text.disabled;previewDisplay()}source.addEventListener('change',update);text.addEventListener('input',update);caption.addEventListener('input',update);text.disabled=feature.source!=='custom';text.parentElement.hidden=text.disabled;form.append(row)})}
 const status=document.createElement('p');status.className='inline-editor-status';status.setAttribute('role','status');const actions=document.createElement('div');actions.className='editor-form-actions';const save=document.createElement('button');save.type='submit';save.className='editor-button editor-primary';save.textContent='Сохранить оформление';actions.append(save,editorButton('Отмена',()=>{finishExclusiveInline();renderExclusive();syncEditorUI()}),editorButton('Другие эксклюзивы',()=>{finishExclusiveInline();renderExclusive();showExclusiveList()}));form.append(actions,status)
 form.addEventListener('submit',async event=>{event.preventDefault();slot.title=title.value.trim();slot.description=description.value.trim();const next=ContentRepository.getSnapshot();const i=next.editorial.exclusives.findIndex(value=>value.propertyId===id);if(i<0){status.textContent='Эксклюзив уже удалён. Обновите страницу.';return}next.editorial.exclusives[i]=slot;save.disabled=true;status.textContent='Сохраняем…';try{await ContentRepository.save(next);finishExclusiveInline();renderExclusive();syncEditorUI()}catch(error){status.textContent=error.message;save.disabled=false;if(error.status===401){editorActive=false;ContentRepository.config.authenticated=false;finishExclusiveInline();syncEditorUI();showEditorLogin()}}})
 function previewDisplay(){form.querySelectorAll('.editor-feature-preview').forEach((node,index)=>{const f=[...slot.display.stats,...slot.display.photoFacts][index];node.textContent=displayFeatureValue(p,f)+(f.label?' · '+f.label:'')});document.querySelector('.featured-image>img').src=p.photos[slot.display.cover]||p.photos[0]||'assets/property-placeholder.svg';cover.querySelectorAll('button').forEach((button,index)=>button.setAttribute('aria-pressed',String(index===slot.display.cover)));document.querySelectorAll('.featured-image-facts>span').forEach((span,index)=>{const f=slot.display.photoFacts[index];span.replaceChildren(propertyIcon(f.icon),document.createTextNode(' '+displayFeatureValue(p,f)))})}
 panel.prepend(form);previewDisplay();panel.scrollIntoView({behavior:'smooth',block:'start'})
}
function finishExclusiveInline(){document.querySelector('.exclusive-inline-form')?.remove();const copy=document.querySelector('.featured-copy');if(copy)copy.hidden=false}
function exportEditorContent(){
  const json=JSON.stringify(ContentRepository.getSnapshot(),null,2)
  editorContent.replaceChildren()
  const description=document.createElement('p');description.className='editor-intro';description.textContent='Данные каталога и редакционных подборок. Скачайте файл или скопируйте JSON для переноса.'
  const field=editorField(editorContent,'JSON данных','export',json,'textarea');field.readOnly=true;field.rows=12
  const actions=document.createElement('div');actions.className='editor-form-actions';actions.append(editorButton('Скачать JSON',()=>{const blob=new Blob([json],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='delmar-content.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}),editorButton('Копировать JSON',async()=>{try{await navigator.clipboard.writeText(json);editorNotice('JSON скопирован.')}catch{field.focus();field.select();editorNotice('Текст выделен. Скопируйте его сочетанием Ctrl/Cmd+C.')}}),editorButton('К объектам',showObjectList));editorContent.append(description,actions);editorOpen('Экспорт данных')
}
document.querySelector('#editor-entry').addEventListener('click',()=>{setMenuOpen(false);editorActive?showEditorView('objects'):showEditorLogin()})
editorToolbar.querySelectorAll('[data-editor-view]').forEach(button=>button.addEventListener('click',()=>showEditorView(button.dataset.editorView)))
document.querySelector('#editor-logout').addEventListener('click',async()=>{try{await EditorSession.signOut();editorActive=false;finishExclusiveInline();renderExclusive();if(editorRoot.open)editorRoot.close();syncEditorUI()}catch(error){editorOpen('Выход из редактора');editorNotice(error.message)}})
syncEditorUI()

document.addEventListener('delmar:top-changed',syncEditorUI)
document.addEventListener('delmar:content-changed',syncEditorUI)
document.querySelectorAll('#exclusive-prev,#exclusive-next').forEach(button=>button.addEventListener('click',()=>{finishExclusiveInline();renderExclusive();syncEditorUI()}))
