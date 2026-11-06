import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, summarize, pickRound, isPlayable, answerText, safeSourceUrl, sliderBounds, defaultGuess, type Listing } from '../src/lib/game.ts';
const lot = (id='1', price=3000): Listing => ({id,title:'Квартира',location:'Калининград',city:'Калининград',region:'Калининградская область',area:30,price,images:['/images/a.webp','/images/b.webp'],sourceUrl:'https://www.avito.ru/kaliningrad/kvartiry/test_123',active:null,availability:'source_snapshot',propertyType:'apartment',dealType:'nightly_rent',priceUnit:'night',checkIn:'2026-11-14',checkOut:'2026-11-15',guests:2});
test('accuracy scoring is symmetric and scale independent; rounding and zero floor',()=>{
 for(const [guess,points] of [[3000,100],[2700,90],[3300,90],[2250,75],[6000,0],[9000,0]]) assert.equal(evaluate(lot(),guess).points,points);
 assert.equal(evaluate(lot('2',2000),1800).points,evaluate(lot('3',4500),4050).points);
 assert.equal(evaluate(lot('4',3499),3499).points,100);assert.equal(evaluate(lot('half',4000),900).points,23);assert.equal(evaluate(lot('half2',4000),7100).points,23);assert.throws(()=>evaluate(lot(),-1));assert.throws(()=>evaluate(lot(),NaN));assert.throws(()=>evaluate(lot(),1.5));
 assert.match(answerText(evaluate(lot(),2500)),/500 ₽ меньше/);assert.match(answerText(evaluate(lot(),3500)),/500 ₽ больше/);assert.match(answerText(evaluate(lot(),3000)),/Точное/);
});
test('gross totals reconcile without cancelling opposite deviations',()=>{
 const s=summarize([evaluate(lot('1'),4000),evaluate(lot('2'),2500),evaluate(lot('3'),3000)]);
 assert.equal(s.overpayment,1000);assert.equal(s.underpayment,500);assert.equal(s.net,500);assert.equal(s.points,250);
});
test('850 threshold; majority controls type even if net is opposite',()=>{
 assert.equal(summarize(Array.from({length:10},()=>evaluate(lot(),2550))).profile,'Балтийский локал');
 assert.equal(summarize(Array.from({length:10},()=>evaluate(lot(),2520))).profile,'Охотник за халявой');
 const a=[...Array.from({length:6},()=>evaluate(lot('1',2000),1000)),...Array.from({length:4},()=>evaluate(lot('2',4500),7000))];
 assert.equal(summarize(a).profile,'Охотник за халявой');assert.ok(summarize(a).net>0);
 assert.equal(summarize(Array.from({length:10},()=>evaluate(lot(),4500))).profile,'Янтарный спонсор');
});
test('tied counts use relative deviation and then stable largest-error tie break',()=>{
 assert.equal(summarize([evaluate(lot(),1500),evaluate(lot(),3900)]).profile,'Охотник за халявой');
 assert.equal(summarize([evaluate(lot(),4500),evaluate(lot(),1500)]).profile,'Янтарный спонсор');
});
test('nightly context, geography and photos required; unknown activity is preserved',()=>{
 assert.ok(isPlayable(lot()));assert.equal(lot().active,null);
 for(const patch of [{active:false},{region:'Республика Коми'},{propertyType:'house'},{dealType:'sale'},{priceUnit:'month'},{availability:'unknown'},{checkIn:'2026-02-31'},{checkOut:'2026-11-16'},{guests:0},{images:['/images/a.webp']}]) assert.equal(isPlayable({...lot(),...patch} as Listing),false);
 assert.equal(safeSourceUrl('https://avito.ru.evil.example/a'),false);assert.equal(safeSourceUrl('javascript:alert(1)'),false);
});
test('ten unique comparable lots; slider includes every price and exact-ruble answers',()=>{
 const pool=Array.from({length:20},(_,i)=>lot(String(i),1850+i*139));const round=pickRound([...pool,lot('1'),{...lot('no'),active:false}],()=>0.1);
 assert.equal(round.length,10);assert.equal(new Set(round.map(l=>l.id)).size,10);assert.ok(round.every(isPlayable));assert.throws(()=>pickRound(pool.slice(0,9)));
 assert.throws(()=>pickRound([...pool.slice(0,9),{...lot('different'),guests:3}]));
 const b=sliderBounds(pool);assert.ok(b.min<1850&&b.max>4500);assert.ok(Number.isSafeInteger(defaultGuess(pool)));
});
