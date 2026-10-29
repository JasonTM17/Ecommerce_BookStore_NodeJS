const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const books = require('./demo-catalog.json');
const sharp = require(path.resolve(__dirname, '../../frontend/node_modules/sharp'));
const escape = value => value.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]));
function lines(text, limit = 22) {
  const result = []; let current = '';
  for (const word of text.split(' ')) {
    if (current && (current+' '+word).length > limit) { result.push(current); current = word; }
    else current += (current ? ' ' : '')+word;
  }
  if (current) result.push(current);
  return result;
}
async function cover(book, index) {
  const colors = ['#173c50','#5d3048','#345544','#5d4329','#303b66','#614340'];
  const text = lines(book[1]).map((line,i) => `<text x="52" y="${190+i*48}" font-size="35" font-weight="bold">${escape(line)}</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="700"><rect width="500" height="700" fill="${colors[index%colors.length]}"/><rect x="25" y="25" width="450" height="650" fill="none" stroke="#e4c79b"/><g fill="#fff5e4" font-family="DejaVu Sans,Arial,sans-serif"><text x="52" y="85" font-size="17">BOOKSTORE • DEMO COLLECTION</text>${text}<text x="52" y="560" font-size="17">${escape(book[2])}</text><text x="52" y="625" font-size="15">BÌA MINH HỌA • DỮ LIỆU MẪU</text></g></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
(async () => {
  if (process.env.APP_CATALOG_SEED_CONFIRM !== 'ADD_DEMO_CATALOG') throw Error('Explicit demo catalog confirmation required');
  const { SUPABASE_URL: host, SUPABASE_SERVICE_ROLE_KEY: key, SUPABASE_STORAGE_BUCKET: bucket, DB_SSL_CA: ca } = process.env;
  if (!host || !key || !bucket || !ca) throw Error('Dedicated Supabase configuration required');
  const url = new URL(process.env.DATABASE_URL);
  for (const field of ['sslmode','sslcert','sslrootcert']) url.searchParams.delete(field);
  const db = new Client({ connectionString: url.toString(), ssl: { ca, rejectUnauthorized: true } });
  await db.connect();
  let inserted = 0, skipped = 0;
  try {
    const images = [];
    for (let index = 0; index < books.length; index++) {
      const object = `demo-catalog/v1/book-${String(index+1).padStart(3,'0')}.png`;
      const imageUrl = `${host}/storage/v1/object/public/${bucket}/${object}`;
      if (!(await fetch(imageUrl, { method: 'HEAD', signal: AbortSignal.timeout(15000) })).ok) {
        const upload = await fetch(`${host}/storage/v1/object/${bucket}/${object}`, { method: 'POST', signal: AbortSignal.timeout(30000), headers: { apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'image/png','x-upsert':'false' }, body: await cover(books[index],index) });
        if (!upload.ok && upload.status !== 409) throw Error('Demo cover upload failed '+upload.status);
      }
      images.push(imageUrl);
      if ((index+1)%10===0) console.log(`Prepared ${index+1}/${books.length} original illustrative covers`);
    }
    await db.query('BEGIN');
    await db.query("SELECT pg_advisory_xact_lock(hashtext('bookstore-demo-catalog-v1'))");
    const brand = (await db.query("INSERT INTO brands(name,description,is_active) VALUES($1,$2,true) ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING id",['BookStore Demo','Danh mục minh họa; giá và tồn kho giả lập, không đại diện ấn bản thương mại.'])).rows[0];
    for (let i=0;i<books.length;i++) {
      const [category,name,author,summary] = books[i];
      const existing = await db.query('SELECT id FROM products WHERE name=$1 AND author=$2 LIMIT 1',[name,author]);
      if (existing.rowCount) { skipped++; continue; }
      const cat = (await db.query('INSERT INTO categories(name,description,is_active,sort_order) VALUES($1,$2,true,10) ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING id',[category,`Sách ${category.toLowerCase()}`])).rows[0];
      const price = 65000 + (i%16)*12000, discount = [0,5,10,15,20][i%5];
      await db.query(`INSERT INTO products(name,author,short_description,description,price,discount_percent,discount_price,stock_quantity,image_url,category_id,brand_id,language,is_active,is_featured,is_new,is_bestseller,sort_order,specifications)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true,$13,$14,false,$15,$16)`,
        [name,author,summary,summary+'\n\nSản phẩm minh họa cho BookStore: giá, khuyến mãi và tồn kho là dữ liệu demo; bìa được thiết kế minh họa, không phải bìa của một ấn bản cụ thể.',price,discount,Math.round(price*(100-discount)/100),25+(i*7)%96,images[i],cat.id,brand.id,i>=40?'English':'Vietnamese',i%5===0,i%4===0,i,JSON.stringify({demo:true,seed:'catalog-v1',editionVerified:false})]);
      inserted++;
    }
    await db.query('COMMIT');
    const total = Number((await db.query('SELECT count(*) FROM products WHERE is_active=true')).rows[0].count);
    console.log(JSON.stringify({status:'PASS',inserted,skipped,totalActive:total,existingOrdersAndStockPreserved:true}));
  } catch (error) { await db.query('ROLLBACK').catch(()=>{}); throw error; }
  finally { await db.end(); }
})().catch(error => { console.error('Catalog seed failed: '+error.message.replace(/postgresql:\/\/\S+/g,'[redacted]')); process.exitCode=1; });
