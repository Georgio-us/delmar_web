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
let activeTag = 'all'
let activeDeveloper = 'all'
let visibleCount = 5

function updateCatalog(scroll = false) {
  syncFilterMenus()
  $$('[data-goal]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.goal === activeGoal)))
  $$('[data-category]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === activeTag)))
  const matches = cards.filter(card => {
    const tags = card.dataset.tags.split(' ')
    const amount = Number(card.dataset.price) || null
    const priceMatch = price.value === 'all' || (price.value === 'request' ? amount === null : amount !== null && (price.value === 'above' ? amount >= 200000 : amount <= Number(price.value)))
    return priceMatch && (activeGoal === 'all' || (card.dataset.goals || '').split(' ').includes(activeGoal)) &&
      (activeTag === 'all' || tags.includes(activeTag)) &&
      (activeDeveloper === 'all' || card.dataset.developer === activeDeveloper) &&
      (district.value === 'all' || card.dataset.district === district.value) &&
      (type.value === 'all' || card.dataset.type === type.value) &&
      (rooms.value === 'all' || card.dataset.rooms === rooms.value) &&
      (area.value === 'all' || Number(card.dataset.area) >= Number(area.value))
  })
  cards.forEach(card => card.hidden = !matches.includes(card) || matches.indexOf(card) >= visibleCount)
  $('#catalog-empty').hidden = matches.length > 0
  more.hidden = matches.length <= visibleCount
  if (scroll) catalog.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
function resetCatalog() {
  district.value = type.value = area.value = rooms.value = price.value = 'all'
  activeTag = activeDeveloper = activeGoal = 'all'
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
  setInterest(interest)
  $('#contact').scrollIntoView({ behavior: 'smooth', block: 'start' })
}
[district, type, area, rooms, price].forEach(select => select.addEventListener('change', () => { visibleCount = 5; updateCatalog() }))
$('#reset-filters').addEventListener('click', resetCatalog)
more.addEventListener('click', () => { visibleCount += 5; updateCatalog() })
$$('[data-category]').forEach(button => button.addEventListener('click', () => {
  activeTag = button.dataset.category
  visibleCount = 5
  updateCatalog(true)
}))
$$('[data-route]').forEach(button => button.addEventListener('click', () => {
  if (button.dataset.route === 'sell') routeToContact('Продажа квартиры')
  else routeToCatalog(button.dataset.route)
}))
$$('.developer-card[data-developer]').forEach(button => button.addEventListener('click', () => routeToCatalog('new', button.dataset.developer)))
$$('[data-developer-request]').forEach(button => button.addEventListener('click', () => {
  routeToContact('Новостройка')
  $('#contact-form [name="message"]').value = `Интересуют объекты застройщика ${button.dataset.developerRequest}`
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
  $('#quiz-next').firstChild.textContent = step === 3 ? 'Показать объекты ' : 'Далее '
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
  if (key === 'choice' && quizAnswers.choice === 'sell') { quiz.close(); routeToContact('Продажа квартиры') }
}))
$('#quiz-back').addEventListener('click', () => showQuizStep(quizStep - 1))
$('#quiz-next').addEventListener('click', () => {
  if (quizStep < 3) { showQuizStep(quizStep + 1); return }
  quiz.close()
  resetCatalog()
  type.value = quizAnswers.choice
  district.value = quizAnswers.district || 'all'
  rooms.value = quizAnswers.rooms || 'all'
  visibleCount = 5
  updateCatalog(true)
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

document.addEventListener('click', event => {
  const button = event.target.closest('.favorite'); if (!button) return
  const active = button.getAttribute('aria-pressed') !== 'true'
  button.setAttribute('aria-pressed', String(active))
  button.setAttribute('aria-label', active ? 'Убрать из избранного' : 'Добавить в избранное')
})
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
$('#contact-form').addEventListener('submit', event => {
  event.preventDefault()
  $('#form-status').textContent = 'Спасибо, запрос заполнен - подключим отправку после согласования контактов агентства'
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
    return {...slot, location:property.location,area:property.area+' м²',rooms:property.rooms+(property.id==='p005'?' спальни':' комнаты'),image:property.photos[0],alt:property.title,pdf:property.pdf}
  })
}
rebuildExclusives()
const exclusiveIcons = { area: $('.featured-specs svg').cloneNode(true), pin: $('.featured-location svg').cloneNode(true), terrace: $$('.featured-specs svg')[2].cloneNode(true), sea: $$('.featured-image-facts svg')[1].cloneNode(true) }
let exclusiveIndex = 0
const presentation = $('.presentation-button')
function renderExclusive() {
  $('#featured').hidden = !exclusiveItems.length
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
  const values = $$('.featured-specs strong')
  values[0].textContent = item.area; values[1].textContent = item.rooms; values[2].textContent = item.feature
  $$('.featured-specs small')[2].textContent = item.caption
  $$('.featured-specs svg')[2].replaceWith(exclusiveIcons[exclusiveIndex ? 'pin' : 'terrace'].cloneNode(true))
  $('.featured-copy>p:not(.featured-location)').textContent = item.description
  const image = $('.featured-image>img'); image.src = item.image; image.alt = item.alt
  $$('.featured-image-facts>span').forEach((span,index) => span.replaceChildren(exclusiveIcons[index ? (exclusiveIndex ? 'pin' : 'sea') : (exclusiveIndex ? 'area' : 'terrace')].cloneNode(true), document.createTextNode(' ' + item.facts[index])))
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
  image.src = currentProperty.photos[index]
  image.alt = `${currentProperty.title} — фото ${index + 1}`
  $$('#property-thumbnails button').forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)))
}
function openProperty(id) {
  const property = propertyInventory.find(item => item.id === id)
  if (!property) return
  currentProperty = property
  $('#property-title').textContent = property.title
  $('#property-reference').textContent = `Объект ${property.id.slice(1)} · ${property.type}`
  $('#property-location').textContent = property.location
  $('#property-price').textContent = formatPropertyPrice(property.price)
  $('#property-description').textContent = property.description
  $('#property-specs').replaceChildren()
  const unitPrice = Math.round(property.price / property.area)
  ;[`${property.area} м²`, `${property.rooms} комнаты`, `${formatPropertyPrice(unitPrice)} / м²`].forEach(text => {
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
propertyForm.addEventListener('submit', event => {
  event.preventDefault()
  const name = $('[name="name"]', propertyForm)
  const phone = $('[name="phone"]', propertyForm)
  const validName = name.value.trim().length > 0
  const validPhone = phone.value.replace(/\D/g, '').length >= 7
  name.setAttribute('aria-invalid', String(!validName)); phone.setAttribute('aria-invalid', String(!validPhone))
  if (!validName || !validPhone) {
    $('#property-form-status').textContent = !validName ? 'Укажите ваше имя.' : 'Укажите телефон — не менее 7 цифр.'
    ;(!validName ? name : phone).focus()
    return
  }
  $('#property-form-status').textContent = `${propertyRequestIntent}: «${currentProperty.title}», ${formatPropertyPrice(currentProperty.price)}. Заявка заполнена. Это демонстрационная форма: отправка в агентство пока не подключена.`
})
renderExclusive()

document.addEventListener('delmar:content-changed',()=>{cards=$$('.catalog-card');rebuildExclusives();renderExclusive();updateCatalog();if(propertyDialog.open){if(propertyInventory.some(p=>p.id===currentProperty.id))openProperty(currentProperty.id);else propertyDialog.close()}})
