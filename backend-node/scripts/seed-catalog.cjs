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
      const isVn = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(name) || /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(author);
      const bookLang = isVn ? 'Vietnamese' : 'English';
      await db.query(`INSERT INTO products(name,author,short_description,description,price,discount_percent,discount_price,stock_quantity,image_url,category_id,brand_id,language,is_active,is_featured,is_new,is_bestseller,sort_order,specifications)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true,$13,$14,false,$15,$16)`,
        [name,author,summary,summary+'\n\nSản phẩm minh họa cho BookStore: giá, khuyến mãi và tồn kho là dữ liệu demo; bìa được thiết kế minh họa, không phải bìa của một ấn bản cụ thể.',price,discount,Math.round(price*(100-discount)/100),25+(i*7)%96,images[i],cat.id,brand.id,bookLang,i%5===0,i%4===0,i,JSON.stringify({demo:true,seed:'catalog-v1',editionVerified:false})]);
      inserted++;
    }

    // Seed rich public coupons
    const coupons = [
      { code: 'BOOKWORM20', desc: 'Giảm 20% tối đa 50.000đ cho đơn từ 200.000đ', type: 'PERCENTAGE', val: 20, min: 200000, max: 50000 },
      { code: 'FREESHIP', desc: 'Miễn phí giao hàng (giảm 30.000đ) cho đơn từ 150.000đ', type: 'FIXED_AMOUNT', val: 30000, min: 150000, max: 30000 },
      { code: 'TECHVIP25', desc: 'Ưu đãi 25% tối đa 80.000đ cho sách Công nghệ', type: 'PERCENTAGE', val: 25, min: 250000, max: 80000 },
      { code: 'READING50K', desc: 'Giảm 50.000đ cho đơn hàng sách từ 350.000đ', type: 'FIXED_AMOUNT', val: 50000, min: 350000, max: 50000 },
      { code: 'WELCOME15', desc: 'Chào bạn mới: Giảm 15% tối đa 40.000đ đơn đầu tiên', type: 'PERCENTAGE', val: 15, min: 100000, max: 40000 },
      { code: 'SUMMERVIBES', desc: 'Mùa hè rực rỡ: Giảm 35.000đ cho mọi đơn từ 200.000đ', type: 'FIXED_AMOUNT', val: 35000, min: 200000, max: 35000 }
    ];
    for (const c of coupons) {
      await db.query(`
        INSERT INTO coupons(code, description, type, discount_value, min_order_amount, max_discount, usage_limit, used_count, per_user_limit, is_active, is_public, start_date, end_date)
        VALUES($1, $2, $3, $4, $5, $6, 1000, 12, 2, true, true, NOW(), NOW() + INTERVAL '90 days')
        ON CONFLICT(code) DO UPDATE SET is_active=true, is_public=true, description=EXCLUDED.description`,
        [c.code, c.desc, c.type, c.val, c.min, c.max]
      );
    }

    // Seed active flash sales on 3 top products
    const flashSaleProducts = (await db.query('SELECT id, price FROM products WHERE is_active=true AND is_featured=true LIMIT 3')).rows;
    for (const fsp of flashSaleProducts) {
      const salePrice = Math.round(Number(fsp.price) * 0.7);
      await db.query(`
        INSERT INTO flash_sales(product_id, original_price, sale_price, start_time, end_time, stock_limit, sold_count, is_active)
        VALUES($1, $2, $3, NOW() - INTERVAL '1 hour', NOW() + INTERVAL '48 hours', 30, 8, true)
        ON CONFLICT DO NOTHING`,
        [fsp.id, fsp.price, salePrice]
      );
    }

    // Seed realistic reviews from customer account
    const sampleCustomer = (await db.query("SELECT id FROM users WHERE email='customer@bookstore.dev' LIMIT 1")).rows[0];
    if (sampleCustomer) {
      const reviewCandidates = (await db.query('SELECT id FROM products WHERE is_active=true LIMIT 15')).rows;
      const reviewTexts = [
        'Sách đóng gói rất kỹ, gáy sách phẳng phiu, giao hàng nhanh.',
        'Nội dung rất sâu sắc, đọc một mạch không dứt được. Rất đáng tiền!',
        'Bìa sách đẹp, giấy dày dặn in rõ nét, bản dịch rất mượt mà.',
        'Tác phẩm kinh điển phải có trên kệ sách của mọi người. 5 sao!',
        'Giao nhanh trong 2 ngày, sách nguyên seal thơm mùi giấy mới.'
      ];
      for (let rIdx = 0; rIdx < reviewCandidates.length; rIdx++) {
        const prod = reviewCandidates[rIdx];
        const comment = reviewTexts[rIdx % reviewTexts.length];
        await db.query(`
          INSERT INTO reviews(user_id, product_id, rating, comment, is_verified_purchase, helpful_count, sort_order)
          VALUES($1, $2, $3, $4, true, $5, $6)
          ON CONFLICT DO NOTHING`,
          [sampleCustomer.id, prod.id, 5, comment, (rIdx * 3) % 15, rIdx]
        );
      }
    }

    await db.query('COMMIT');
    const total = Number((await db.query('SELECT count(*) FROM products WHERE is_active=true')).rows[0].count);
    console.log(JSON.stringify({status:'PASS',inserted,skipped,totalActive:total,existingOrdersAndStockPreserved:true}));
  } catch (error) { await db.query('ROLLBACK').catch(()=>{}); throw error; }
  finally { await db.end(); }
})().catch(error => { console.error('Catalog seed failed: '+error.message.replace(/postgresql:\/\/\S+/g,'[redacted]')); process.exitCode=1; });
