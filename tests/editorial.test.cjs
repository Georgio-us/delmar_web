const {test}=require('node:test'),assert=require('node:assert/strict')
const {validateContent,normalizeEditorialContent,matchesCollection,propertyCode,displayFeatureValue}=require('../content-validation.js')
const seed={version:1,properties:require('../server/seed-properties.json'),editorial:require('../server/seed-editorial.cjs'),trash:[]}
test('legacy editorial migration retains inventory and choices without filling vacant places',()=>{
 const source=structuredClone(seed),state=normalizeEditorialContent(source)
 assert.deepEqual(state.properties,source.properties);assert.deepEqual(state.editorial.collections.all,source.editorial.top)
 assert.deepEqual(state.editorial.collections.center,[]);assert.equal(state.editorial.collections.sea.length,2)
 assert.equal(propertyCode(state.properties[0]),'D001');assert.equal(validateContent(state),state)
 assert.deepEqual(normalizeEditorialContent(state),state)
})
test('independent collections, empty inventory and configurable exclusive display are validated',()=>{
 const state=normalizeEditorialContent(seed),p=state.properties.find(p=>p.id==='p005')
 state.editorial.collections.sea=['p005'];assert.equal(validateContent(state),state);assert.deepEqual(state.editorial.collections.all,['p003','p005','p001'])
 state.editorial.exclusives[0].display.stats[0]={icon:'price',source:'price',text:'',label:'стоимость'}
 assert.equal(displayFeatureValue(p,state.editorial.exclusives[0].display.stats[0]),'$320 000');p.price=999;assert.equal(displayFeatureValue(p,state.editorial.exclusives[0].display.stats[0]),'$999')
 assert.equal(matchesCollection(p,'sea'),true)
 const invalid=structuredClone(state);invalid.editorial.collections.center=['p005'];assert.throws(()=>validateContent(invalid))
 const badIcon=structuredClone(state);badIcon.editorial.exclusives[0].display.stats[0].icon='script';assert.throws(()=>validateContent(badIcon))
 const noPhotos=structuredClone(state);noPhotos.properties[0].photos=[];assert.equal(validateContent(noPhotos),noPhotos)
 const empty=normalizeEditorialContent({version:1,properties:[],editorial:{top:[null,null,null],exclusives:[]},trash:[]});assert.equal(validateContent(empty),empty)
})
