import test from 'node:test';import assert from 'node:assert/strict';
import {parseCsv,parseListingsCsv,localImagePath} from '../src/lib/csv.ts';
const header='id,title,price,area,location,region,availability,checkIn,checkOut,guests,priceUnit,sourceUrl,images,active';
const row='1,"Студия, 2 кровати",3499,30,Калининград,Калининградская область,source_snapshot,2026-11-14,2026-11-15,2,night,https://www.avito.ru/kaliningrad/test_123,/images/a.webp;/images/b.webp,';
test('quoted CSV, BOM and exact prices; availability never fabricated',()=>{
 assert.deepEqual(parseCsv('\uFEFFa;b\r\n"one;two";"three\nline"'),[['a','b'],['one;two','three\nline']]);assert.throws(()=>parseCsv('a,b\n"oops'));
 const result=parseListingsCsv(header+'\n'+row);assert.equal(result.listings[0].price,3499);assert.equal(result.listings[0].active,null);
});
test('CSV filters inactive, other regions, duplicates and incomplete galleries',()=>{
 const r=parseListingsCsv(header+'\n'+[row,row,row+'false',row.replace('Калининградская область','Москва'),row.replace('source_snapshot','unknown'),row.replace(';/images/b.webp','')].join('\n'));
 assert.equal(r.listings.length,1);assert.equal(r.skipped,5);assert.throws(()=>parseListingsCsv('id,title\n1,x'),/Не хватает/);
});
test('untrusted image paths and source URLs rejected',()=>{
 for(const p of ['//evil.example/a.webp','https://evil.example/a.jpg','/images/../a.jpg','/images//a.jpg','/images/a.svg']) assert.throws(()=>localImagePath(p));assert.equal(localImagePath('images/a.webp'),'/images/a.webp');
 assert.equal(parseListingsCsv(header+'\n'+row.replace('https://www.avito.ru/kaliningrad/test_123','https://evil.example')).listings.length,0);
});
