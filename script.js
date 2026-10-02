const $ = (selector, root = document) => root.querySelector(selector)
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)]
const catalog = $('#catalog')
let cards = $$('.catalog-card')
const district = $('#filter-district')
const type = $('#filter-type')
const area = $('#filter-area')
const rooms = $('#filter-rooms')
const price = $('#filter-price')
const more = $('#catalog-more')
const filterControls = new Map()
function closeFilterMenus(except = null) {
  filterControls.forEach(control => {
    if (control === except) return
    control.list.hidden = true
    control.trigger.setAttribute('aria-expanded', 'false')
  })
}
function syncFilterMenus() {
  filterControls.forEach((control, select) => {
    select.closest('label').classList.toggle('is-active-filter',select.value!=='all')
    control.trigger.querySelector('.filter-value').textContent = select.selectedOptions[0].textContent
    control.trigger.setAttribute('aria-label', `${control.name}: ${select.selectedOptions[0].textContent}`)
    control.list.querySelectorAll('button').forEach(option => {
      option.setAttribute('aria-selected', String(option.dataset.value === select.value))
    })
  })
}
$$('.catalog-filters select').forEach(select => {
  const label = select.closest('label')
  const name = label.firstChild.textContent.trim()
  const trigger = document.createElement('button')
  trigger.type = 'button'
  trigger.className = 'filter-trigger'
  trigger.setAttribute('aria-label', name)
  trigger.setAttribute('aria-haspopup', 'listbox')
  trigger.setAttribute('aria-expanded', 'false')
  trigger.innerHTML = `<span class="filter-value"></span><svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  const list = document.createElement('div')
  list.className = 'filter-options'
  list.setAttribute('role', 'listbox')
  list.setAttribute('aria-label', name)
  list.hidden = true
  Array.from(select.options).forEach(option => {
    const item = document.createElement('button')
    item.type = 'button'
    item.dataset.value = option.value
    item.setAttribute('role', 'option')
    item.textContent = option.textContent
    item.addEventListener('click', () => {
      select.value = option.value
      select.dispatchEvent(new Event('change', { bubbles: true }))
      closeFilterMenus()
      trigger.focus()
    })
    list.append(item)
  })
  select.hidden = true
  label.append(trigger, list)
  filterControls.set(select, { name, trigger, list })
  trigger.addEventListener('click', () => {
    const open = list.hidden
    closeFilterMenus()
    list.hidden = !open
    trigger.setAttribute('aria-expanded', String(open))
  })
  trigger.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      closeFilterMenus()
      list.hidden = false
      trigger.setAttribute('aria-expanded', 'true')
      list.querySelector('button').focus()
    }
  })
  list.addEventListener('keydown', event => {
    const options = [...list.querySelectorAll('button')]
    const index = options.indexOf(document.activeElement)
    if (event.key === 'Escape') { closeFilterMenus(); trigger.focus() }
    if (event.key === 'ArrowDown') { event.preventDefault(); options[(index + 1) % options.length].focus() }
    if (event.key === 'ArrowUp') { event.preventDefault(); options[(index - 1 + options.length) % options.length].focus() }
  })
})
document.addEventListener('click', event => {
  if (!event.target.closest('.catalog-filters')) closeFilterMenus()
})
syncFilterMenus()
let activeGoal = 'all'
let activeDeveloper = 'all'
let visibleCount = 5

function updateCatalog(scroll = false) {
  syncFilterMenus()
  $('#more-filters').classList.toggle('has-active-filters',rooms.value!=='all')
  $$('[data-goal]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.goal === activeGoal)))
  const matches = cards.filter(card => {
    const amount = Number(card.dataset.price) || null
    const priceMatch = price.value === 'all' || (price.value === 'request' ? amount === null : amount !== null && (price.value === 'above' ? amount >= 200000 : amount <= Number(price.value)))
    return priceMatch && (activeGoal === 'all' || (card.dataset.goals || '').split(' ').includes(activeGoal)) &&
      (activeDeveloper === 'all' || card.dataset.developer === activeDeveloper) &&
      (district.value === 'all' || card.dataset.district === district.value) &&
      (type.value === 'all' || card.dataset.type === type.value) &&
      (rooms.value === 'all' || card.dataset.rooms === rooms.value) &&
      (area.value === 'all' || Number(card.dataset.area) >= Number(area.value))
  })
  cards.forEach(card => card.hidden = !matches.includes(card) || matches.indexOf(card) >= visibleCount)
  $('#catalog-empty').hidden = matches.length > 0
  $('#catalog-empty').textContent = propertyInventory.length ? 'По этим параметрам объектов пока нет - измените фильтры' : 'Объекты скоро появятся — оставьте заявку на подбор'
  more.hidden = matches.length <= visibleCount
  if (scroll) catalog.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
function resetCatalog() {
  district.value = type.value = area.value = rooms.value = price.value = 'all'
  activeDeveloper = activeGoal = 'all'
  visibleCount = 5
  updateCatalog()
}
function routeToCatalog(kind, developer = 'all') {
  resetCatalog()
  if (kind === 'new' || kind === 'resale') type.value = kind
  activeDeveloper = developer
  visibleCount = 5
  updateCatalog(true)
}
function setInterest(value) {
  $('[name="interest"]').value = value
  $('#interest-trigger').firstChild.textContent = `${value} `
  $('#interest-trigger').setAttribute('aria-expanded', 'false')
  $('#interest-options').hidden = true
}
function routeToContact(interest) {
  openLead({source:'service:'+interest,title:interest,interest})
}
[district, type, area, rooms, price].forEach(select => select.addEventListener('change', () => { visibleCount = 5; updateCatalog() }))
$('#reset-filters').addEventListener('click', resetCatalog)
more.addEventListener('click', () => { visibleCount += 5; updateCatalog() })
$$('[data-category]').forEach(button => button.addEventListener('click', () => {
  activeTopCategory = button.dataset.category
  renderTopCards()
  document.dispatchEvent(new CustomEvent('delmar:top-changed'))
}))
$$('[data-route]').forEach(button => button.addEventListener('click', () => {
  if (button.dataset.route === 'sell') routeToContact('Продажа квартиры')
  else routeToCatalog(button.dataset.route)
}))
$$('.developer-card').forEach(button => button.addEventListener('click', () => {
  const developer=button.querySelector('strong').textContent.trim()
  openLead({source:'developer:'+(button.dataset.developer||button.dataset.developerRequest),title:'Запросить объекты: '+developer,interest:'Объекты застройщика',developer,summary:'Оставьте контакты — подготовим подборку объектов застройщика '+developer+'.'})
}))
$('#developers-more').addEventListener('click', event => {
  const button = event.currentTarget
  const open = button.getAttribute('aria-expanded') !== 'true'
  $$('[data-developer-extra]').forEach(card => card.hidden = !open)
  button.setAttribute('aria-expanded', String(open))
  button.firstChild.textContent = open ? 'Скрыть застройщиков ' : 'Показать всех застройщиков '
})
$$('[data-footer-type]').forEach(link => link.addEventListener('click', event => {
  event.preventDefault()
  if (link.dataset.footerType === 'sell') routeToContact('Продажа квартиры')
  else routeToCatalog(link.dataset.footerType)
}))
updateCatalog()
renderTopCards()

const quiz = $('#quiz-dialog')
let quizStep = 1
const quizAnswers = { choice: null, district: null, rooms: null }
function showQuizStep(step) {
  quizStep = step
  $$('.quiz-panel').forEach(panel => panel.hidden = Number(panel.dataset.quizStep) !== step)
  $('#quiz-progress-text').textContent = `Вопрос ${step} из 3`
  $('#quiz-progress-fill').style.width = `${step / 3 * 100}%`
  $('#quiz-back').hidden = step === 1
  const key = step === 1 ? 'choice' : step === 2 ? 'district' : 'rooms'
  $('#quiz-next').disabled = !quizAnswers[key]
  $('#quiz-next').firstChild.textContent = step === 3 ? 'Оставить контакты ' : 'Далее '
}
$('#open-quiz').addEventListener('click', () => {
  quizAnswers.choice = quizAnswers.district = quizAnswers.rooms = null
  $$('.quiz-answer-grid button').forEach(item => item.classList.remove('is-selected'))
  showQuizStep(1)
  quiz.showModal()
})
$$('[data-quiz-choice], [data-quiz-district], [data-quiz-rooms]').forEach(button => button.addEventListener('click', () => {
  const key = button.hasAttribute('data-quiz-choice') ? 'choice' : button.hasAttribute('data-quiz-district') ? 'district' : 'rooms'
  quizAnswers[key] = button.dataset[`quiz${key[0].toUpperCase()}${key.slice(1)}`]
  $$(`[data-quiz-${key}]`).forEach(item => item.classList.toggle('is-selected', item === button))
  $('#quiz-next').disabled = false
  if (key === 'choice' && quizAnswers.choice === 'sell') { quiz.close(); openLead({source:'quiz',title:'Продажа квартиры',interest:'Продажа квартиры',answers:{...quizAnswers},summary:'Оставьте телефон — обсудим продажу вашей квартиры.'}) }
}))
$('#quiz-back').addEventListener('click', () => showQuizStep(quizStep - 1))
$('#quiz-next').addEventListener('click', () => {
  if (quizStep < 3) { showQuizStep(quizStep + 1); return }
  quiz.close()
  const choice=$(`[data-quiz-choice="${quizAnswers.choice}"]`).textContent.trim(),districtName=$(`[data-quiz-district="${quizAnswers.district}"]`).textContent.trim(),roomName=$(`[data-quiz-rooms="${quizAnswers.rooms}"]`).textContent.trim()
  openLead({source:'quiz',title:'Получить подборку квартир',interest:'Быстрый опрос',answers:{...quizAnswers},summary:[choice,districtName,roomName].join(' · ')})
})

const interestTrigger = $('#interest-trigger')
const interestOptions = $('#interest-options')
interestTrigger.addEventListener('click', () => {
  interestOptions.hidden = !interestOptions.hidden
  interestTrigger.setAttribute('aria-expanded', String(!interestOptions.hidden))
})
$$('[data-interest]').forEach(button => button.addEventListener('click', () => setInterest(button.dataset.interest)))
document.addEventListener('click', event => {
  if (!event.target.closest('.interest-field')) { interestOptions.hidden = true; interestTrigger.setAttribute('aria-expanded', 'false') }
})
interestTrigger.addEventListener('keydown', event => {
  if (event.key === 'ArrowDown') { event.preventDefault(); interestOptions.hidden = false; interestTrigger.setAttribute('aria-expanded', 'true'); $('[data-interest]', interestOptions).focus() }
})
interestOptions.addEventListener('keydown', event => {
  if (event.key === 'Escape') { interestOptions.hidden = true; interestTrigger.focus() }
})

const articles = {
  new: { category: 'Новостройки', title: 'Как выбрать квартиру в новостройке Одессы', paragraphs: [
    'Начните с района, бюджета и срока сдачи дома - эти три параметра быстрее всего сокращают список вариантов',
    'Сравните планировки, этаж, условия оплаты и документы по каждому жилому комплексу, который рассматриваете',
    'Перед бронированием уточните, что входит в стоимость квартиры и какие расходы появятся при оформлении'
  ] },
  resale: { category: 'Вторичное жильё', title: 'Что проверить при покупке вторичной квартиры', paragraphs: [
    'Проверьте право собственности, состав зарегистрированных лиц и наличие обременений до внесения задатка',
    'На просмотре обратите внимание на состояние коммуникаций, окна, вентиляцию и возможные перепланировки',
    'Заранее согласуйте перечень мебели и техники, сроки освобождения квартиры и порядок передачи ключей'
  ] },
  sell: { category: 'Продажа квартиры', title: 'Подготовка квартиры к продаже', paragraphs: [
    'Соберите документы на объект и проверьте, какие вопросы покупатель может задать до просмотра',
    'Подготовьте квартиру к съёмке и показам - свет, порядок и понятная информация об объекте помогают оценить её быстрее',
    'Определите цену с учётом похожих предложений и заранее продумайте условия сделки'
  ] }
}
$$('[data-article]').forEach(button => button.addEventListener('click', () => {
  const article = articles[button.dataset.article]
  $('#article-category').textContent = article.category
  $('#article-title').textContent = article.title
  $('#article-body').replaceChildren(...article.paragraphs.map(text => { const p = document.createElement('p'); p.textContent = text; return p }))
  $('#article-dialog').showModal()
}))
$('#article-contact').addEventListener('click', () => $('#article-dialog').close())
$$('[data-close]').forEach(button => button.addEventListener('click', () => $(`#${button.dataset.close}`).close()))
$$('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close() } }))

let reviewIndex = 0
const reviewCards = $$('.review-grid article')
function focusReview(nextIndex) {
  reviewIndex = (nextIndex + reviewCards.length) % reviewCards.length
  $('#reviews-count').textContent = `${reviewIndex + 1} / ${reviewCards.length}`
  reviewCards[reviewIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
}
$('#reviews-prev').addEventListener('click', () => focusReview(reviewIndex - 1))
$('#reviews-next').addEventListener('click', () => focusReview(reviewIndex + 1))

const menu = $('.menu-toggle')
const mobileNav = $('#mobile-nav')
let menuBodyOverflow = ''
function syncMenuClosed() {
  menu.setAttribute('aria-expanded', 'false')
  menu.setAttribute('aria-label', 'Открыть меню')
  document.body.style.overflow = menuBodyOverflow
}
function setMenuOpen(open) {
  if (open && !mobileNav.open) {
    menuBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    menu.setAttribute('aria-expanded', 'true')
    menu.setAttribute('aria-label', 'Закрыть меню')
    $('#language-options').hidden = true
    $('#language-trigger').setAttribute('aria-expanded', 'false')
    mobileNav.showModal()
  } else if (!open && mobileNav.open) { mobileNav.close(); syncMenuClosed() }
}
menu.addEventListener('click', () => setMenuOpen(!mobileNav.open))
$('.menu-close').addEventListener('click', () => setMenuOpen(false))
mobileNav.addEventListener('close', syncMenuClosed)
$$('.site-menu a').forEach(link => link.addEventListener('click', () => setMenuOpen(false)))

const infoDialog = $('#info-dialog')
function openInfo(title, body) { $('#info-title').textContent = title; $('.info-dialog p').textContent = body; infoDialog.showModal() }
$('#open-video').addEventListener('click', () => openInfo('Видеообзор', 'Видео будет доступно после подключения канала DELMAR GROUP'))
$('#youtube-link').addEventListener('click', () => openInfo('Видеоблог', 'Ссылка на канал будет добавлена после согласования'))
$$('[data-video]').forEach(button => button.addEventListener('click', () => openInfo(button.dataset.video, 'Видео будет доступно после подключения канала DELMAR GROUP')))
$$('[data-social]').forEach(button => button.addEventListener('click', () => openInfo(button.dataset.social, 'Ссылка на страницу будет добавлена после согласования')))
$('.info-dialog .dialog-close').addEventListener('click', () => infoDialog.close())
// One form per action context; only explicitly selected catalog controls filter objects.
const leadDialog=$('#lead-dialog'),leadForm=$('#lead-form')
let leadContext=null,leadPreviousOverflow=''
function openLead(context){
  leadContext={...context};leadForm.reset();$$('[aria-invalid]',leadForm).forEach(input=>input.removeAttribute('aria-invalid'))
  $('#lead-title').textContent=context.title;$('#lead-summary').textContent=context.summary||'Оставьте контакты — свяжемся с вами и обсудим запрос.';$('#lead-status').textContent=''
  if(!leadDialog.open){leadPreviousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';leadDialog.showModal()}
}
leadDialog.addEventListener('close',()=>document.body.style.overflow=leadPreviousOverflow)
async function submitLead(form,status,context){
  const name=$('[name="name"]',form),phone=$('[name="phone"]',form),message=$('[name="message"]',form)
  const validName=Boolean(name.value.trim()),validPhone=phone.value.replace(/\D/g,'').length>=7&&phone.value.replace(/\D/g,'').length<=15
  name.setAttribute('aria-invalid',String(!validName));phone.setAttribute('aria-invalid',String(!validPhone))
  if(!validName||!validPhone){status.textContent=!validName?'Укажите ваше имя.':'Укажите телефон — от 7 до 15 цифр.';(!validName?name:phone).focus();return}
  const button=$('[type="submit"]',form);button.disabled=true;status.textContent='Отправляем заявку…'
  try{await contentRequest('/api/leads',{method:'POST',body:JSON.stringify({...context,name:name.value.trim(),phone:phone.value.trim(),message:message?.value.trim()||''})});status.textContent='Спасибо! Заявка получена. Мы свяжемся с вами.';form.reset()}catch(error){status.textContent=error.message||'Не удалось отправить заявку. Попробуйте ещё раз.'}finally{button.disabled=false}
}
leadForm.addEventListener('submit',event=>{event.preventDefault();submitLead(leadForm,$('#lead-status'),leadContext)})
$('#contact-form').noValidate=true
$('#contact-form').addEventListener('submit',event=>{event.preventDefault();submitLead(event.currentTarget,$('#form-status'),{source:'contact-form',title:'Форма внизу страницы',interest:$('[name="interest"]',event.currentTarget).value})})
$$('a[href="#contact"]').filter(link=>!link.closest('.menu-links')&&!link.hasAttribute('data-footer-type')).forEach((link,index)=>{
 const section=link.closest('section,header,footer,dialog'),source=(section?.id||section?.tagName.toLowerCase()||'page')+':cta:'+index
 link.addEventListener('click',event=>{event.preventDefault();if(mobileNav.open)setMenuOpen(false);if($('#article-dialog').open)$('#article-dialog').close();openLead({source,sourceLabel:section?.querySelector('h1,h2,h3')?.textContent.trim().replace(/\s+/g,' ')||'Связаться: '+(section?.tagName.toLowerCase()||'страница'),title:link.textContent.trim(),interest:'Подбор недвижимости'})})
})

if (new URLSearchParams(location.search).get('quiz') === '1') { showQuizStep(1); quiz.showModal() }

// Goal shortcuts are separate from the three-step quiz and compose with catalog filters.
$$('[data-goal]').forEach(button => button.addEventListener('click', () => {
  if (button.dataset.goal === 'all') resetCatalog()
  activeGoal = button.dataset.goal
  visibleCount = 5
  updateCatalog(true)
}))
let exclusiveItems = []
function rebuildExclusives() {
  exclusiveItems = ContentRepository.getSnapshot().editorial.exclusives.filter(slot => slot.propertyId).map(slot => {
    const property = propertyInventory.find(p => p.id === slot.propertyId)
    return {...slot, location:property.location,area:property.area+' м²',rooms:property.rooms+(property.id==='p005'?' спальни':' комнаты'),image:property.photos[slot.display?.cover||0]||property.photos[0]||'assets/property-placeholder.svg',alt:property.title,pdf:property.pdf}
  })
}
rebuildExclusives()
const exclusiveIcons = { area: $('.featured-specs svg').cloneNode(true), pin: $('.featured-location svg').cloneNode(true), terrace: $$('.featured-specs svg')[2].cloneNode(true), sea: $$('.featured-image-facts svg')[1].cloneNode(true) }
let exclusiveIndex = 0
const presentation = $('.presentation-button')
function renderExclusive() {
  $('#featured').hidden = !exclusiveItems.length
  $('.featured-copy').hidden=!exclusiveItems.length;$('.featured-image').hidden=!exclusiveItems.length
  $('.featured-panel').classList.toggle('editor-empty',!exclusiveItems.length)
  if (!exclusiveItems.length) return
  exclusiveIndex = Math.min(exclusiveIndex,exclusiveItems.length-1)
  const item = exclusiveItems[exclusiveIndex]
  const heading = $('#featured-title')
  const titleButton = document.createElement('button')
  titleButton.type = 'button'; titleButton.className = 'exclusive-title-open'
  item.title.split('\n').forEach((line, index) => { if (index) titleButton.append(document.createElement('br')); titleButton.append(document.createTextNode(line)) })
  titleButton.addEventListener('click', () => openProperty(exclusiveItems[exclusiveIndex]?.propertyId))
  heading.replaceChildren(titleButton)
  $('#exclusive-price').textContent = formatPropertyPrice(propertyInventory.find(property => property.id === exclusiveItems[exclusiveIndex]?.propertyId).price)
  const location = $('.featured-location')
  location.replaceChildren(location.querySelector('svg'), document.createTextNode(' ' + item.location))
  const property=propertyInventory.find(p=>p.id===item.propertyId),display=item.display||defaultExclusiveDisplay(item)
  $$('.featured-specs>span').forEach((span,index)=>{const f=display.stats[index];span.querySelector('svg').replaceWith(propertyIcon(f.icon));span.querySelector('strong').textContent=displayFeatureValue(property,f);span.querySelector('small').textContent=f.label})
  $('.featured-copy>p:not(.featured-location)').textContent = item.description
  const image = $('.featured-image>img'); image.src = item.image; image.alt = item.alt
  $$('.featured-image-facts>span').forEach((span,index)=>{const f=display.photoFacts[index];span.replaceChildren(propertyIcon(f.icon),document.createTextNode(' '+displayFeatureValue(property,f)))})
  let code=$('.featured-code');if(!code){code=document.createElement('span');code.className='featured-code';$('.featured-meta').append(code)}code.textContent=propertyCode(property);code.dataset.noI18n=''
  $('#exclusive-count').textContent = `${exclusiveIndex + 1} / ${exclusiveItems.length}`
  presentation.href = item.pdf || '#contact'
  if (item.pdf) presentation.setAttribute('download','DELMAR-penthouse-presentation.pdf'); else presentation.removeAttribute('download')
  $('.action-label',presentation).textContent = item.pdf ? 'Получить презентацию' : 'Запросить презентацию'
}
$('#exclusive-prev').addEventListener('click', () => { exclusiveIndex = (exclusiveIndex + exclusiveItems.length - 1) % exclusiveItems.length; renderExclusive() })
$('#exclusive-next').addEventListener('click', () => { exclusiveIndex = (exclusiveIndex + 1) % exclusiveItems.length; renderExclusive() })
presentation.addEventListener('click', event => {
  const item = exclusiveItems[exclusiveIndex]
  if (item.pdf) return
  event.preventDefault()
  openProperty(exclusiveItems[exclusiveIndex]?.propertyId)
  revealPropertyForm('Запросить презентацию')
})

$('#more-filters').addEventListener('click', () => {
  const extra = $('#catalog-extra')
  extra.hidden = !extra.hidden
  $('#more-filters').setAttribute('aria-expanded', String(!extra.hidden))
})


// One detail view and one inventory shared by catalog, top picks and exclusives.
const propertyDialog = $('#property-dialog')
const propertyForm = $('#property-form')
let currentProperty = null
let propertyRequestIntent = 'Заявка по объекту'
let previousBodyOverflow = ''
function formatPropertyPrice(amount) { return '$' + new Intl.NumberFormat('ru-RU').format(amount) }
function setPropertyPhoto(index) {
  const image = $('#property-photo')
  image.src = currentProperty.photos[index]||'assets/property-placeholder.svg'
  image.alt = `${currentProperty.title} — фото ${index + 1}`
  $$('#property-thumbnails button').forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)))
}
function openProperty(id) {
  const property = propertyInventory.find(item => item.id === id)
  if (!property) return
  currentProperty = property
  $('#property-title').textContent = property.title
  $('#property-reference').textContent = `${propertyCode(property)} · ${property.type}${contentState.editorial.exclusives.some(slot=>slot.propertyId===property.id)?' · Эксклюзив':''}`
  $('#property-location').textContent = property.location
  $('#property-price').textContent = formatPropertyPrice(property.price)
  $('#property-description').textContent = property.description
  $('#property-specs').replaceChildren()
  const unitPrice = Math.round(property.price / property.area)
  ;[`${property.area} м²`, `${property.rooms} комн.`, `${formatPropertyPrice(unitPrice)} / м²`,...(property.floor!=null?[property.floor+' этаж']:[]),...(property.baths!=null?[property.baths+' ванн.']:[]),...(property.terraceArea?[property.terraceArea+' м² терраса']:[])].forEach(text => {
    const item = document.createElement('span'); item.textContent = text; $('#property-specs').append(item)
  })
  const thumbs = $('#property-thumbnails'); thumbs.replaceChildren()
  property.photos.forEach((src, index) => {
    const button = document.createElement('button'); button.type = 'button'
    button.setAttribute('aria-label', `Показать фото ${index + 1}`)
    button.setAttribute('aria-pressed', String(index === 0))
    const image = document.createElement('img'); image.src = src; image.alt = ''
    button.append(image); button.addEventListener('click', () => setPropertyPhoto(index)); thumbs.append(button)
  })
  setPropertyPhoto(0)
  const pdf = $('#property-pdf'); pdf.hidden = !property.pdf
  if (property.pdf) pdf.href = property.pdf; else pdf.removeAttribute('href')
  propertyForm.reset(); propertyForm.hidden = true
  $$('#property-form [aria-invalid]').forEach(input => input.removeAttribute('aria-invalid'))
  $('#property-form-status').textContent = ''
  if (!propertyDialog.open) {
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    propertyDialog.showModal()
  }
  propertyDialog.scrollTop = 0
}
function revealPropertyForm(intent) {
  propertyRequestIntent = intent
  $('#property-form-title').textContent = intent
  propertyForm.hidden = false
  $('#property-form-status').textContent = ''
  $('[name="name"]', propertyForm).focus({preventScroll:true})
  propertyForm.scrollIntoView({behavior:'smooth', block:'nearest'})
}
document.addEventListener('click',event => { const button=event.target.closest('[data-open-property]');if(button)openProperty(button.dataset.openProperty) })
$('#exclusive-open').addEventListener('click', () => openProperty(exclusiveItems[exclusiveIndex]?.propertyId))
$('#property-apply').addEventListener('click', () => revealPropertyForm('Заявка по объекту'))
$('#property-availability').addEventListener('click', () => revealPropertyForm('Уточнить наличие объекта'))
propertyDialog.addEventListener('close', () => { document.body.style.overflow = previousBodyOverflow })
propertyForm.addEventListener('submit',event=>{event.preventDefault();submitLead(propertyForm,$('#property-form-status'),{source:'property:'+currentProperty.id,propertyId:currentProperty.id,title:propertyRequestIntent,interest:propertyRequestIntent})})

renderExclusive()

document.addEventListener('delmar:content-changed',()=>{cards=$$('.catalog-card');rebuildExclusives();renderExclusive();updateCatalog();if(propertyDialog.open){if(propertyInventory.some(p=>p.id===currentProperty.id))openProperty(currentProperty.id);else propertyDialog.close()}})
