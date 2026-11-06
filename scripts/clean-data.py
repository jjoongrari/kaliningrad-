"""Rebuild the Kaliningrad snapshot from the supplied Avito CSV. No live-status inference."""
import csv, json, re, sys, statistics, hashlib, shutil, urllib.parse, urllib.request
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from PIL import Image, ImageOps
ROOT = Path(__file__).resolve().parents[1]
DEFAULT = ROOT / 'source' / 'original-kaliningrad.csv'
source = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT
rows = list(csv.reader(source.open(encoding='utf-8-sig', newline='')))
headers, raw = rows[0], rows[1:]
assert len(headers) == 23 and len(raw) >= 10
normalize = lambda s: re.sub(r'\s+', ' ', s).strip()
prepared, rejected, seen = [], [], set()
for number, row in enumerate(raw, 2):
    if len(row) != len(headers): raise ValueError(f'Row {number}: invalid column count')
    url = urllib.parse.urlsplit(row[0]); match = re.search(r'_(\d+)$', url.path)
    if not match or url.hostname != 'www.avito.ru': raise ValueError(f'Row {number}: invalid source URL')
    ident = match.group(1)
    if ident in seen: rejected.append({'sourceRow':number, 'id':ident, 'reason':'duplicate_id'}); continue
    seen.add(ident)
    title, address, description = normalize(row[7]), normalize(row[13]), normalize(row[14])
    price = int(re.sub(r'[^0-9]', '', row[10])); area = re.search(r'(\d+(?:[,.]\d+)?)\s*м²', title)
    beds = re.search(r'(\d+)\s*кроват', title); rooms = re.search(r'^(\d+)-к\.', title)
    if not area or price <= 0: raise ValueError(f'Row {number}: invalid price or area')
    params = urllib.parse.parse_qs(url.query)
    dates = {key:sorted(set(v.replace('-', '') for v in params.get(key, []))) for key in ['checkIn','checkOut']}
    if dates != {'checkIn':['20261114'],'checkOut':['20261115']}: raise ValueError(f'Row {number}: unexpected stay dates')
    guests = int(params['guests'][0]); assert guests == 2
    source_url = urllib.parse.urlunsplit((url.scheme,url.netloc,url.path,urllib.parse.urlencode({'checkIn':'2026-11-14','checkOut':'2026-11-15','guests':guests}),''))
    reason = 'themed_nonstandard_accommodation' if ident == '4659286506' else ''
    if reason and 'тематическое помещение' not in description.lower(): raise ValueError('Exclusion definition changed')
    city = 'Малое Исаково' if address.startswith('Пос. Малое Исаково') else 'Калининград'
    item = {'id':ident,'title':title,'price':price,'area':float(area.group(1).replace(',','.')),'rooms':int(rooms.group(1)) if rooms else 0,'beds':int(beds.group(1)) if beds else None,'location':address,'city':city,'region':'Калининградская область','propertyType':'apartment','dealType':'nightly_rent','currency':'RUB','priceUnit':'night','checkIn':'2026-11-14','checkOut':'2026-11-15','guests':guests,'active':None,'availability':'source_snapshot','sourceUrl':source_url,'rating':float(row[8].replace(',','.')) if re.fullmatch(r'[0-5](?:[,.]\d)?',row[8]) else None,'secondaryPrice':int(re.sub(r'\D','',row[8])) if '₽' in row[8] else None,'reviewCount':int(re.sub(r'\D','',row[9])) if re.search(r'\d',row[9]) else None,'images':[], 'photoUrls':list(dict.fromkeys(u.strip() for u in row[1:6] if u.strip())), 'included':not bool(reason),'exclusionReason':reason,'sourceRow':number}
    prepared.append(item)
(ROOT/'public/images').mkdir(parents=True,exist_ok=True)
for p in (ROOT/'public/images').glob('*'): p.unlink()
tasks = [(item,u,index) for item in prepared if item['included'] for index,u in enumerate(item['photoUrls'],1)]
def fetch(task):
    item,url,index=task; p=ROOT/'public/images'/f'{item["id"]}_{index:02}.webp'
    try:
        req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
        with urllib.request.urlopen(req,timeout=25) as response: data=response.read(12_000_000)
        import io
        im=ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert('RGB'); original=im.size
        im.thumbnail((768,768),Image.Resampling.LANCZOS); im.save(p,'WEBP',quality=75,method=6)
        return item['id'],index,'/images/'+p.name,url,original,im.size,None
    except Exception as error: return item['id'],index,None,url,None,None,str(error)
results=[]
with ThreadPoolExecutor(max_workers=10) as pool:
    for n,future in enumerate(as_completed([pool.submit(fetch,t) for t in tasks]),1):
        results.append(future.result())
        if n%50==0: print(f'Photos {n}/{len(tasks)}',flush=True)
photo_rows=[];errors=[]
by_id={i['id']:i for i in prepared}
for ident,index,local,url,original,size,error in sorted(results,key=lambda r:(r[0],r[1])):
    if error: errors.append({'id':ident,'position':index,'error':error});continue
    by_id[ident]['images'].append(local);photo_rows.append({'listing_id':ident,'position':index,'local_file':local,'source_url':url,'original_width':original[0],'original_height':original[1],'width':size[0],'height':size[1]})
for item in prepared:
    if item['included'] and len(item['images'])<2: item['included']=False; item['exclusionReason']='fewer_than_two_downloaded_photos'
listings=[{k:v for k,v in item.items() if k not in ['photoUrls','included','exclusionReason','sourceRow']} for item in prepared if item['included']]
if len(listings)<10: raise ValueError('Insufficient playable listings')
(ROOT/'public/data').mkdir(exist_ok=True)
(ROOT/'source').mkdir(exist_ok=True)
if source.resolve()!=DEFAULT.resolve(): shutil.copyfile(source,DEFAULT)
(ROOT/'public/data/listings.json').write_text(json.dumps(listings,ensure_ascii=False,separators=(',',':'))+'\n')
meta={'label':'Квартиры на Балтике','region':'Калининградская область','description':f'{len(listings)} объявлений из предоставленной выгрузки. Цены за одну ночь 14–15 ноября 2026 года для двух гостей. Дата сбора и онлайн-активность в источнике не указаны.','photoInfo':'Реальные фотографии сохранены локально в WebP, без увеличения исходного разрешения.','checkIn':'2026-11-14','checkOut':'2026-11-15','guests':2,'availability':'source_snapshot','sourceCount':len(raw),'playableCount':len(listings)}
(ROOT/'public/data/catalog-meta.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
fields=['id','title','price','area','rooms','beds','location','city','region','propertyType','dealType','priceUnit','checkIn','checkOut','guests','availability','sourceUrl','images']
for name in ['source.csv','template.csv']:
    with (ROOT/'public/data'/name).open('w',encoding='utf-8-sig',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=fields);writer.writeheader()
        for item in listings: writer.writerow({k:';'.join(item[k]) if k=='images' else item[k] for k in fields})
clean_fields=['id','title','price_rub_per_night','area_m2','rooms','beds','city','address','rating','review_count','check_in','check_out','guests','source_url','secondary_price_rub','included_in_game','exclusion_reason']
with (ROOT/'public/data/listings-clean.csv').open('w',encoding='utf-8-sig',newline='') as f:
    writer=csv.DictWriter(f,fieldnames=clean_fields);writer.writeheader()
    for i in prepared: writer.writerow(dict(zip(clean_fields,[i['id'],i['title'],i['price'],i['area'],i['rooms'],i['beds'],i['city'],i['location'],i['rating'],i['reviewCount'],i['checkIn'],i['checkOut'],i['guests'],i['sourceUrl'],i['secondaryPrice'],str(i['included']).lower(),i['exclusionReason']])))
with (ROOT/'public/data/photos.csv').open('w',encoding='utf-8-sig',newline='') as f:
    writer=csv.DictWriter(f,fieldnames=['listing_id','position','local_file','source_url','original_width','original_height','width','height']);writer.writeheader();writer.writerows(photo_rows)
prices=[i['price'] for i in listings]
report={'sourceFile':source.name,'sourceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'inputRows':len(raw),'inputColumns':len(headers),'uniqueIds':len(seen),'exactDuplicateRows':len(raw)-len({tuple(r) for r in raw}),'playableCount':len(listings),'photoCount':len(photo_rows),'photoBytes':sum(p.stat().st_size for p in (ROOT/'public/images').glob('*')),'priceMin':min(prices),'priceMedian':statistics.median(prices),'priceMax':max(prices),'semanticColumnCollisions':[{'sourceRow':i['sourceRow'],'id':i['id'],'field':'rating','actualMeaning':'secondary_price','value':i['secondaryPrice']} for i in prepared if i['secondaryPrice'] is not None],'sourceAvailability':'unknown','scrapeDate':'unknown','stayDates':['2026-11-14','2026-11-15'],'guests':2,'excluded':[{'sourceRow':i['sourceRow'],'id':i['id'],'price':i['price'],'reason':i['exclusionReason']} for i in prepared if not i['included']]+rejected,'photoErrors':errors,'removedFields':['CSS-class headers','more-photo counter','host badges','host names and profile links','host ratings','video and duplicated thumbnails','advertising descriptions'],'outlierPolicy':'Outliers reviewed against description. No price-based automatic deletion. The 13000 RUB record describes a themed venue for adults, not standard accommodation; excluded for game scope.'}
(ROOT/'source/cleaning-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False),flush=True)
