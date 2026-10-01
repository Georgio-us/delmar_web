// Initialize shared data before the existing UI attaches its event handlers.
(async()=>{
  function load(name){return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=name+'?v=20261001r2';script.onload=resolve;script.onerror=()=>reject(new Error('Не удалось загрузить '+name));document.head.append(script)})}
  try{
    await load('property-data.js');await load('content-validation.js');await load('content-store.js');await ContentRepository.ready
    await load('script.js');await load('editor.js');await load('localization.js')
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)ContentRepository.refreshPublic()})
    setInterval(()=>ContentRepository.refreshPublic(),60000)
  }catch(error){console.error(error.message)}
})()
