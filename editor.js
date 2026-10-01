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
editorToolbar.innerHTML='<span>Режим редактора <small>Сохранение на сервере</small></span><button type="button" data-editor-view="objects">Объекты</button><button type="button" data-editor-view="exclusives">Эксклюзивы</button><button type="button" data-editor-view="top">Топ-3</button><button type="button" id="editor-logout">Выйти</button>'
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
  const input=document.createElement(options?'select':type==='textarea'?'textarea':'input');input.name=name
  if(options)for(const [key,text]of options){const option=document.createElement('option');option.value=key;option.textContent=text;input.append(option)}
  else if(type!=='textarea')input.type=type
  input.value=value;if(type==='number'){input.min='1';input.step=name==='rooms'?'1':'any'}
  if(type==='textarea')input.rows=3
  wrap.append(input);parent.append(wrap);return input
}
function editorChoices(parent,label,name,value,options){
  const field=document.createElement('fieldset');field.className='editor-choices';const legend=document.createElement('legend');legend.textContent=label;field.append(legend)
  for(const [key,text]of options){const item=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.name=name;input.value=key;input.checked=value.split(' ').includes(key);const span=document.createElement('span');span.textContent=text;item.append(input,span);field.append(item)}
  parent.append(field)
}
function syncEditorUI(){
  document.body.classList.toggle('editor-active',editorActive);editorToolbar.hidden=!editorActive
  document.querySelector('#editor-entry').textContent=editorActive?'Редактировать сайт':'Вход для редактора'
  document.querySelectorAll('.editor-inline').forEach(button=>button.remove())
  if(!editorActive)return
  for(const [selector,view]of [['.featured-panel','exclusives'],['.top-grid','top'],['.catalog-panel','objects']]){
    const parent=document.querySelector(selector);const button=editorButton('Редактировать',()=>showEditorView(view),'editor-inline');parent.prepend(button)
  }
  document.querySelectorAll('.catalog-card').forEach(card=>{const button=editorButton('Изменить объект',()=>showPropertyEditor(card.dataset.property),'editor-inline editor-card-edit');card.append(button)})
}
function showEditorLogin(){
  editorContent.innerHTML='<p class="editor-intro">Войдите с логином и паролем редактора. Изменения сохраняются на сервере и доступны всем посетителям.</p><form id="editor-login" novalidate><div class="editor-fields"></div><button class="editor-button editor-primary" type="submit">Войти</button></form>'
  const form=editorContent.querySelector('form'),fields=form.querySelector('.editor-fields')
  const login=editorField(fields,'Логин','login'),password=editorField(fields,'Пароль','password','','password');login.autocomplete='username';password.autocomplete='current-password'
  form.addEventListener('submit',async event=>{event.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;try{if(!await EditorSession.signIn(login.value.trim(),password.value)){editorNotice('Проверьте логин и пароль.');password.setAttribute('aria-invalid','true');return}password.value='';editorActive=true;syncEditorUI();showEditorView('objects')}catch(error){editorNotice(error.message)}finally{button.disabled=false}})
  editorOpen('Вход для редактора')
  if(!ContentRepository.config.editorEnabled)editorNotice('Вход ещё не настроен. Необходимы база данных и данные редактора в настройках сервера.')
}
function showEditorView(view){
  if(!editorActive){showEditorLogin();return}
  editorCurrentView=view
  if(view==='objects')showObjectList();else showEditorialEditor(view)
}
function showObjectList(){
  editorContent.innerHTML='<p class="editor-intro">Каталог объектов. Все подборки используют эти же записи.</p><div class="editor-list-tools"></div><div class="editor-object-list"></div>'
  const tools=editorContent.querySelector('.editor-list-tools')
  const search=document.createElement('input');search.type='search';search.placeholder='Найти объект';search.setAttribute('aria-label','Найти объект');search.value=editorSearch;tools.append(search)
  tools.append(editorButton('Добавить объект',()=>showPropertyEditor(null),'editor-button editor-primary'),editorButton('Экспорт JSON',exportEditorContent))
  if(ContentRepository.getSnapshot().trash?.length)tools.append(editorButton('Восстановить последний удалённый',restoreEditorProperty))
  function list(){
    const container=editorContent.querySelector('.editor-object-list');container.replaceChildren()
    const state=ContentRepository.getSnapshot();const found=state.properties.filter(p=>(p.title+' '+p.location+' '+p.id).toLowerCase().includes(search.value.toLowerCase()))
    if(!found.length){const p=document.createElement('p');p.textContent='Объекты не найдены.';container.append(p)}
    for(const property of found){
      const row=document.createElement('div');row.className='editor-object-row'
      const image=document.createElement('img');image.src=property.photos[0];image.alt='';const text=document.createElement('div');const title=document.createElement('b');title.textContent=property.title;const detail=document.createElement('small');detail.textContent=`${property.location} · ${formatPropertyPrice(property.price)}`;text.append(title,detail)
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
  const snapshot=ContentRepository.getSnapshot(),property=snapshot.properties.find(p=>p.id===id)||{title:'',location:'',price:100000,area:70,rooms:2,kind:'new',district:'primorsky',developer:'',description:'',photos:['assets/bright-apartment.jpg','assets/modern-interior.jpg'],tags:'new family',goals:'life investment',pdf:''}
  editorContent.innerHTML='<button type="button" class="editor-back editor-button">К списку объектов</button><form id="editor-property-form" novalidate><div class="editor-fields"></div><div class="editor-photo-preview"></div><div class="editor-form-actions"><button class="editor-button editor-primary" type="submit">Сохранить объект</button></div></form>'
  editorContent.querySelector('.editor-back').addEventListener('click',showObjectList)
  const form=editorContent.querySelector('form'),fields=form.querySelector('.editor-fields')
  editorField(fields,'Название','title',property.title);editorField(fields,'Расположение','location',property.location)
  editorField(fields,'Цена, USD','price',property.price,'number');editorField(fields,'Площадь, м²','area',property.area,'number');editorField(fields,'Комнаты','rooms',property.rooms,'number')
  editorField(fields,'Тип','kind',property.kind,'text',[['new','Новостройка'],['resale','Вторичная недвижимость']])
  editorField(fields,'Район','district',property.district,'text',[['primorsky','Приморский'],['arkadia','Аркадия'],['center','Центр']])
  const developers=[['','Без застройщика'],...document.querySelectorAll('.developer-card[data-developer]')].map(item=>Array.isArray(item)?item:[item.dataset.developer,item.querySelector('strong')?.textContent||item.dataset.developer])
  editorField(fields,'Застройщик','developer',property.developer,'text',developers)
  const description=editorField(fields,'Описание','description',property.description,'textarea');description.parentElement.classList.add('editor-wide')
  const photos=editorField(fields,'Фотографии — одна ссылка или путь assets/ на строку','photos',property.photos.join('\n'),'textarea');photos.parentElement.classList.add('editor-wide')
  const uploader=editorField(fields,'Или загрузить фотографии (до 8, по 1 МБ)','upload','','file');uploader.accept='image/jpeg,image/png,image/webp';uploader.multiple=true;uploader.removeAttribute('value')
  let photoReadPending=false
  function preview(){const container=form.querySelector('.editor-photo-preview');container.replaceChildren();for(const src of photos.value.split('\n').map(x=>x.trim()).filter(safeAsset).slice(0,8)){const image=document.createElement('img');image.src=src;image.alt='Предпросмотр фотографии';container.append(image)}}
  photos.addEventListener('input',preview);preview()
  uploader.addEventListener('change',async()=>{
    const files=[...uploader.files];if(!files.length)return
    if(files.length>8||files.some(file=>file.size>1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))){editorNotice('Выберите до 8 JPG, PNG или WebP, не более 1 МБ каждый.');uploader.value='';return}
    photoReadPending=true;const save=form.querySelector('[type="submit"]');save.disabled=true
    try{const loaded=await Promise.all(files.map(file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)})));photos.value=loaded.join('\n');preview();editorNotice('Фотографии загружены. Сохраните объект.')}catch{editorNotice('Не удалось прочитать фотографии.')}finally{photoReadPending=false;save.disabled=false}
  })
  editorField(fields,'Презентация PDF — необязательно','pdf',property.pdf||'')
  editorChoices(fields,'Подборки','tags',property.tags,[['new','Новостройки'],['resale','Готовые квартиры'],['sea','У моря'],['family','Для семьи'],['center','Центр Одессы'],['large','Просторные квартиры']])
  editorChoices(fields,'Цель покупки','goals',property.goals,[['life','Для жизни'],['investment','Для инвестиций']])
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(photoReadPending)return
    const data=new FormData(form),next=ContentRepository.getSnapshot()
    const updated={...property,id:id||'p'+String(Math.max(0,...next.properties.map(p=>/^p\d+$/.test(p.id)?Number(p.id.slice(1)):0),...(next.trash||[]).map(entry=>/^p\d+$/.test(entry.property.id)?Number(entry.property.id.slice(1)):0))+1).padStart(3,'0'),title:String(data.get('title')).trim(),location:String(data.get('location')).trim(),price:Number(data.get('price')),area:Number(data.get('area')),rooms:Number(data.get('rooms')),kind:data.get('kind'),type:data.get('kind')==='new'?'Новостройка':'Вторичная недвижимость',district:data.get('district'),developer:data.get('developer'),description:String(data.get('description')).trim(),photos:String(data.get('photos')).split('\n').map(x=>x.trim()).filter(Boolean),tags:data.getAll('tags').join(' '),goals:data.getAll('goals').join(' '),pdf:String(data.get('pdf')).trim()}
    const index=next.properties.findIndex(p=>p.id===id);if(index>=0)next.properties[index]=updated;else next.properties.unshift(updated)
    if(await persistEditor(next,'Объект сохранён.')){showObjectList();editorNotice('Объект сохранён. Каталог и подборки обновлены.')}
  })
  editorOpen(id?'Редактировать объект':'Новый объект')
}
function showDeleteProperty(id){
  const state=ContentRepository.getSnapshot(),property=state.properties.find(p=>p.id===id);if(!property)return
  editorContent.replaceChildren();const copy=document.createElement('p');copy.className='editor-intro';copy.textContent=`Удалить «${property.title}» из каталога? Если объект входит в эксклюзивы или топ-3, соответствующее место останется пустым — его можно заполнить другим объектом.`
  editorContent.append(copy,editorButton('Отмена',showObjectList),editorButton('Удалить объект',async()=>{
    const next=ContentRepository.getSnapshot();next.trash=next.trash||[];next.trash.push({property:next.properties.find(p=>p.id===id),editorial:structuredClone(next.editorial)});next.properties=next.properties.filter(p=>p.id!==id);next.editorial.top=next.editorial.top.map(value=>value===id?null:value);next.editorial.exclusives=next.editorial.exclusives.map(slot=>slot.propertyId===id?{...slot,propertyId:null}:slot)
    if(await persistEditor(next,'Объект удалён.')){showObjectList();editorNotice('Объект удалён. Места в подборках освобождены.')}
  },'editor-button editor-danger'))
  editorOpen('Удалить объект')
}
async function restoreEditorProperty(){
  const next=ContentRepository.getSnapshot(),entry=next.trash?.pop();if(!entry)return
  next.properties.push(entry.property)
  // Restore vacant editorial places only; keep subsequent editorial changes.
  next.editorial.top=next.editorial.top.map((id,i)=>id|| (entry.editorial.top[i]===entry.property.id?entry.property.id:null))
  next.editorial.exclusives=next.editorial.exclusives.map((slot,i)=>!slot.propertyId&&entry.editorial.exclusives[i].propertyId===entry.property.id?entry.editorial.exclusives[i]:slot)
  if(await persistEditor(next,'Объект восстановлен.')){showObjectList();editorNotice('Объект восстановлен.')}
}
function showEditorialEditor(view){
  const state=ContentRepository.getSnapshot();editorContent.innerHTML='<p class="editor-intro"></p><form id="editor-slots-form" novalidate><div class="editor-slots"></div><button type="submit" class="editor-button editor-primary">Сохранить подборку</button></form>'
  editorContent.querySelector('.editor-intro').textContent=view==='top'?'Выберите три объекта в порядке показа. Данные карточек берутся из каталога.':'Выберите объекты и настройте редакционные заголовки, описание и подписи на фотографии. Цена, характеристики и фотографии берутся из каталога.'
  const options=[['','Пустое место'],...state.properties.map(p=>[p.id,p.title])],form=editorContent.querySelector('form')
  for(let i=0;i<3;i++){
    const slot=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=(view==='top'?'Объект ':'Эксклюзив ')+(i+1);slot.append(legend)
    const fields=document.createElement('div');fields.className='editor-fields';slot.append(fields);form.querySelector('.editor-slots').append(slot)
    editorField(fields,'Объект','property-'+i,view==='top'?state.editorial.top[i]||'':state.editorial.exclusives[i].propertyId||'','text',options)
    if(view==='exclusives'){const value=state.editorial.exclusives[i];for(const [key,label]of [['title','Заголовок (перенос строки допустим)'],['description','Короткое описание'],['feature','Особенность'],['caption','Подпись особенности']])editorField(fields,label,key+'-'+i,value[key],key==='title'||key==='description'?'textarea':'text');editorField(fields,'Подпись на фото 1','fact1-'+i,value.facts[0]);editorField(fields,'Подпись на фото 2','fact2-'+i,value.facts[1])}
  }
  form.addEventListener('submit',async event=>{event.preventDefault();const data=new FormData(form),next=ContentRepository.getSnapshot();if(view==='top')next.editorial.top=[0,1,2].map(i=>data.get('property-'+i)||null);else next.editorial.exclusives=[0,1,2].map(i=>({propertyId:data.get('property-'+i)||null,title:data.get('title-'+i).trim(),description:data.get('description-'+i).trim(),feature:data.get('feature-'+i).trim(),caption:data.get('caption-'+i).trim(),facts:[data.get('fact1-'+i).trim(),data.get('fact2-'+i).trim()]}));await persistEditor(next,'Подборка сохранена. Изменения уже видны на сайте.')})
  editorOpen(view==='top'?'Топ-3 объекта':'Три эксклюзива')
}
function exportEditorContent(){
  const json=JSON.stringify(ContentRepository.getSnapshot(),null,2)
  editorContent.replaceChildren()
  const description=document.createElement('p');description.className='editor-intro';description.textContent='Данные каталога и редакционных подборок. Скачайте файл или скопируйте JSON для переноса.'
  const field=editorField(editorContent,'JSON данных','export',json,'textarea');field.readOnly=true;field.rows=12
  const actions=document.createElement('div');actions.className='editor-form-actions';actions.append(editorButton('Скачать JSON',()=>{const blob=new Blob([json],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='delmar-content.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}),editorButton('Копировать JSON',async()=>{try{await navigator.clipboard.writeText(json);editorNotice('JSON скопирован.')}catch{field.focus();field.select();editorNotice('Текст выделен. Скопируйте его сочетанием Ctrl/Cmd+C.')}}),editorButton('К объектам',showObjectList));editorContent.append(description,actions);editorOpen('Экспорт данных')
}
document.querySelector('#editor-entry').addEventListener('click',()=>{setMenuOpen(false);editorActive?showEditorView('objects'):showEditorLogin()})
editorToolbar.querySelectorAll('[data-editor-view]').forEach(button=>button.addEventListener('click',()=>showEditorView(button.dataset.editorView)))
document.querySelector('#editor-logout').addEventListener('click',async()=>{try{await EditorSession.signOut();editorActive=false;if(editorRoot.open)editorRoot.close();syncEditorUI()}catch(error){editorOpen('Выход из редактора');editorNotice(error.message)}})
syncEditorUI()
