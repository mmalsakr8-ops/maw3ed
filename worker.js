const COOKIE = "maw3ed_session";
const TRIAL_DAYS = 14;
const SESSION_DAYS = 30;
const MONTHLY_PRICE = 500;
const YEARLY_PRICE = 5000;

const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", ...extra }
});
const now = () => new Date().toISOString();
const esc = (v = "") => String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));

function page(title, body, script = "") {
  return new Response(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>
  *{box-sizing:border-box}body{margin:0;font-family:Tahoma,Arial,sans-serif;background:#f4f7fb;color:#172033}header{background:#111827;color:#fff;padding:18px 22px;display:flex;justify-content:space-between;align-items:center;gap:12px}header strong{font-size:22px}.wrap{max-width:1150px;margin:28px auto;padding:0 16px}.card{background:#fff;border-radius:18px;padding:22px;margin:14px 0;box-shadow:0 10px 35px #10182812}.hero{text-align:center;padding:60px 20px}.hero h1{font-size:42px;margin:10px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}.btn,button{display:inline-block;border:0;border-radius:10px;padding:12px 16px;background:#4f46e5;color:#fff;cursor:pointer;text-decoration:none;font:inherit}.danger{background:#dc2626}.green{background:#087443}.muted{color:#667085}.ok{color:#087443}.err{color:#b42318}.nav{display:flex;gap:10px;flex-wrap:wrap}input,textarea,select{width:100%;padding:12px;margin:6px 0;border:1px solid #d7dce5;border-radius:10px;font:inherit}textarea{min-height:100px}table{width:100%;border-collapse:collapse;overflow:hidden}th,td{padding:11px;border-bottom:1px solid #eee;text-align:right;vertical-align:top}.pill{display:inline-block;background:#eef2ff;color:#4338ca;padding:6px 10px;border-radius:30px}.small{font-size:13px}.stat{font-size:28px;font-weight:bold}.notice{padding:12px;border-radius:12px;background:#fff7ed;margin:10px 0}.success{padding:12px;border-radius:12px;background:#ecfdf3;margin:10px 0}.actions{display:flex;gap:6px;flex-wrap:wrap}.actions button{padding:8px 10px;font-size:13px}</style></head><body>${body}</body><script>${script}</script></html>`, {headers:{"content-type":"text/html; charset=utf-8"}});
}

async function init(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,phone TEXT UNIQUE,password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'restaurant_admin',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    // IMPORTANT: the existing production table uses token as its primary key. Keep that schema.
    db.prepare(`CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INTEGER NOT NULL,expires_at TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS restaurants(id INTEGER PRIMARY KEY AUTOINCREMENT,owner_id INTEGER NOT NULL UNIQUE,name TEXT NOT NULL,slug TEXT NOT NULL UNIQUE,phone TEXT,whatsapp TEXT,address TEXT,working_hours TEXT,logo_url TEXT,cover_url TEXT,description TEXT,subscription_status TEXT NOT NULL DEFAULT 'trial',trial_ends_at TEXT NOT NULL,subscription_plan TEXT,subscription_starts_at TEXT,subscription_ends_at TEXT,monthly_price REAL NOT NULL DEFAULT 500,yearly_price REAL NOT NULL DEFAULT 5000,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS tables_config(id INTEGER PRIMARY KEY AUTOINCREMENT,restaurant_id INTEGER NOT NULL,table_name TEXT NOT NULL,capacity INTEGER NOT NULL DEFAULT 2,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS bookings(id INTEGER PRIMARY KEY AUTOINCREMENT,restaurant_id INTEGER NOT NULL,table_id INTEGER,customer_name TEXT NOT NULL,customer_phone TEXT NOT NULL,party_size INTEGER NOT NULL,booking_date TEXT NOT NULL,booking_time TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',notes TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,FOREIGN KEY(table_id) REFERENCES tables_config(id) ON DELETE SET NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS payments(id INTEGER PRIMARY KEY AUTOINCREMENT,restaurant_id INTEGER NOT NULL,plan TEXT NOT NULL,amount REAL NOT NULL,paid_at TEXT NOT NULL,starts_at TEXT NOT NULL,ends_at TEXT NOT NULL,method TEXT,notes TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE)`)
  ]);
}

async function hash(p){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(p)));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
function slugify(s){return (s||"restaurant").toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu,"-").replace(/^-+|-+$/g,"").slice(0,45)||"restaurant"}
async function uniqueSlug(db,name,ignoreId=null){const base=slugify(name);let s=base,n=1;while(true){const r=await db.prepare("SELECT id FROM restaurants WHERE slug=?").bind(s).first();if(!r||Number(r.id)===Number(ignoreId))return s;s=`${base}-${++n}`}}
function sessionToken(req){const c=req.headers.get("cookie")||"";const m=c.split(";").map(x=>x.trim()).find(x=>x.startsWith(COOKIE+"="));return m?decodeURIComponent(m.slice(COOKIE.length+1)):null}
function sessionCookie(token){return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS*86400}`}
function clearCookie(){return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`}
async function currentUser(req,db){const token=sessionToken(req);if(!token)return null;return db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>?`).bind(token,now()).first()}
async function ownedRestaurant(db,u){return db.prepare("SELECT * FROM restaurants WHERE owner_id=?").bind(u.id).first()}
function activeRestaurant(r){if(!r)return false;if(r.subscription_status==="active")return !r.subscription_ends_at||new Date(r.subscription_ends_at)>new Date();return !!r.trial_ends_at&&new Date(r.trial_ends_at)>new Date()}
function statusText(r){return activeRestaurant(r)?(r.subscription_status==="active"?"نشط - اشتراك":"نشط - تجربة مجانية"):"منتهي/متوقف"}

async function api(req,url,env){
  const db=env.DB,m=req.method;
  if(url.pathname==="/api/register"&&m==="POST"){
    let b;try{b=await req.json()}catch{return json({error:"بيانات JSON غير صحيحة"},400)}
    const name=String(b.name||"").trim(),email=String(b.email||"").trim().toLowerCase(),phone=String(b.phone||"").trim(),password=String(b.password||"");
    if(!name||!email||password.length<6)return json({error:"الاسم والبريد وكلمة المرور (6 أحرف على الأقل) مطلوبة"},400);
    if(await db.prepare("SELECT id FROM users WHERE lower(email)=lower(?) OR (phone IS NOT NULL AND phone=?)").bind(email,phone||"__none__").first())return json({error:"البريد أو رقم الهاتف مستخدم بالفعل"},409);
    const count=await db.prepare("SELECT COUNT(*) c FROM users").first();
    const role=Number(count.c)===0?"super_admin":"restaurant_admin";
    const created=now(),u=await db.prepare("INSERT INTO users(name,email,phone,password_hash,role,created_at) VALUES(?,?,?,?,?,?)").bind(name,email,phone||null,await hash(password),role,created).run();
    const uid=u.meta.last_row_id,slug=await uniqueSlug(db,name),end=new Date(Date.now()+TRIAL_DAYS*86400000).toISOString();
    const r=await db.prepare("INSERT INTO restaurants(owner_id,name,slug,phone,trial_ends_at,monthly_price,yearly_price,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(uid,name,slug,phone||null,end,MONTHLY_PRICE,YEARLY_PRICE,created).run();
    return json({ok:true,message:`تم إنشاء الحساب بنجاح. لديك تجربة مجانية لمدة ${TRIAL_DAYS} يومًا.`,role,restaurant_id:r.meta.last_row_id,slug},201);
  }
  if(url.pathname==="/api/login"&&m==="POST"){
    let b;try{b=await req.json()}catch{return json({error:"بيانات JSON غير صحيحة"},400)}
    const ident=String(b.identifier??b.email??b.phone??"").trim(),p=String(b.password??"");
    if(!ident||!p)return json({error:"اكتب البريد/الهاتف وكلمة المرور"},400);
    const u=await db.prepare("SELECT * FROM users WHERE lower(email)=lower(?) LIMIT 1").bind(ident).first() || await db.prepare("SELECT * FROM users WHERE phone=? LIMIT 1").bind(ident).first();
    if(!u||u.password_hash!==await hash(p))return json({error:"بيانات الدخول غير صحيحة"},401);
    const token=crypto.randomUUID(),exp=new Date(Date.now()+SESSION_DAYS*86400000).toISOString();
    await db.prepare("INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)").bind(token,u.id,exp).run();
    return json({ok:true,role:u.role,name:u.name},200,{"set-cookie":sessionCookie(token)});
  }
  if(url.pathname==="/api/logout"&&m==="POST"){
    const token=sessionToken(req);if(token)await db.prepare("DELETE FROM sessions WHERE token=?").bind(token).run();
    return json({ok:true},200,{"set-cookie":clearCookie()});
  }
  if(url.pathname==="/api/me"&&m==="GET"){
    const u=await currentUser(req,db);return json({user:u?{id:u.id,name:u.name,email:u.email,phone:u.phone,role:u.role}:null});
  }
  if(url.pathname==="/api/public-booking"&&m==="POST")return publicBooking(req,db);

  const u=await currentUser(req,db);if(!u)return json({error:"يجب تسجيل الدخول"},401);
  if(url.pathname==="/api/restaurant"&&(m==="GET"||m==="PUT")){
    let r=await ownedRestaurant(db,u);if(!r)return json({error:"لا يوجد مطعم مرتبط بالحساب"},404);
    if(m==="PUT"){
      let b;try{b=await req.json()}catch{return json({error:"بيانات غير صحيحة"},400)}
      const name=String(b.name??r.name).trim();if(!name)return json({error:"اسم المطعم مطلوب"},400);
      const s=name!==r.name?await uniqueSlug(db,name,r.id):r.slug;
      await db.prepare(`UPDATE restaurants SET name=?,slug=?,phone=?,whatsapp=?,address=?,working_hours=?,logo_url=?,cover_url=?,description=? WHERE id=?`).bind(name,s,b.phone??r.phone,b.whatsapp??r.whatsapp,b.address??r.address,b.working_hours??r.working_hours,b.logo_url??r.logo_url,b.cover_url??r.cover_url,b.description??r.description,r.id).run();
      r=await ownedRestaurant(db,u);
    }
    return json({restaurant:{...r,status_text:statusText(r)}});
  }
  if(url.pathname==="/api/tables"&&m==="GET"){
    const r=await ownedRestaurant(db,u);if(!r)return json({error:"لا يوجد مطعم"},404);
    return json({tables:(await db.prepare("SELECT * FROM tables_config WHERE restaurant_id=? ORDER BY id").bind(r.id).all()).results});
  }
  if(url.pathname==="/api/tables"&&m==="POST"){
    const r=await ownedRestaurant(db,u),b=await req.json(),name=String(b.table_name||"").trim(),cap=Number(b.capacity||2);
    if(!r)return json({error:"لا يوجد مطعم"},404);if(!name||!Number.isInteger(cap)||cap<1||cap>100)return json({error:"اسم الطاولة والسعة مطلوبان"},400);
    await db.prepare("INSERT INTO tables_config(restaurant_id,table_name,capacity) VALUES(?,?,?)").bind(r.id,name,cap).run();return json({ok:true});
  }
  if(url.pathname.startsWith("/api/tables/")&&m==="PUT"){
    const r=await ownedRestaurant(db,u),id=Number(url.pathname.split("/").pop()),b=await req.json();if(!r)return json({error:"لا يوجد مطعم"},404);
    await db.prepare("UPDATE tables_config SET table_name=?,capacity=?,active=? WHERE id=? AND restaurant_id=?").bind(String(b.table_name||"طاولة").trim(),Math.max(1,Number(b.capacity||2)),b.active===false?0:1,id,r.id).run();return json({ok:true});
  }
  if(url.pathname.startsWith("/api/tables/")&&m==="DELETE"){
    const r=await ownedRestaurant(db,u),id=Number(url.pathname.split("/").pop());if(!r)return json({error:"لا يوجد مطعم"},404);
    await db.prepare("DELETE FROM tables_config WHERE id=? AND restaurant_id=?").bind(id,r.id).run();return json({ok:true});
  }
  if(url.pathname==="/api/bookings"&&m==="GET"){
    const r=await ownedRestaurant(db,u);if(!r)return json({error:"لا يوجد مطعم"},404);
    return json({bookings:(await db.prepare("SELECT b.*,t.table_name FROM bookings b LEFT JOIN tables_config t ON t.id=b.table_id WHERE b.restaurant_id=? ORDER BY b.booking_date DESC,b.booking_time DESC,b.id DESC").bind(r.id).all()).results});
  }
  if(url.pathname.startsWith("/api/bookings/")&&m==="PUT"){
    const r=await ownedRestaurant(db,u),id=Number(url.pathname.split("/").pop()),b=await req.json();if(!r)return json({error:"لا يوجد مطعم"},404);
    if(!["pending","confirmed","completed","cancelled","rejected"].includes(b.status))return json({error:"حالة غير صحيحة"},400);
    await db.prepare("UPDATE bookings SET status=? WHERE id=? AND restaurant_id=?").bind(b.status,id,r.id).run();return json({ok:true});
  }
  if(url.pathname==="/api/admin/restaurants"&&m==="GET"){
    if(u.role!=="super_admin")return json({error:"غير مصرح"},403);
    const rs=(await db.prepare(`SELECT r.*,u.name owner_name,u.email owner_email,u.phone owner_phone,(SELECT COUNT(*) FROM bookings b WHERE b.restaurant_id=r.id) booking_count,(SELECT COALESCE(SUM(p.amount),0) FROM payments p WHERE p.restaurant_id=r.id) paid_total FROM restaurants r JOIN users u ON u.id=r.owner_id ORDER BY r.id DESC`).all()).results;
    return json({restaurants:rs.map(r=>({...r,status_text:statusText(r)}))});
  }
  if(url.pathname.startsWith("/api/admin/renew/")&&m==="POST"){
    if(u.role!=="super_admin")return json({error:"غير مصرح"},403);
    const id=Number(url.pathname.split("/").pop()),b=await req.json().catch(()=>({})),plan=b.plan==="yearly"?"yearly":"monthly",days=plan==="yearly"?365:30,amount=plan==="yearly"?YEARLY_PRICE:MONTHLY_PRICE,method=String(b.method||"نقدي").trim(),notes=String(b.notes||"").trim();
    const r=await db.prepare("SELECT * FROM restaurants WHERE id=?").bind(id).first();if(!r)return json({error:"المطعم غير موجود"},404);
    const start=(r.subscription_status==="active"&&r.subscription_ends_at&&new Date(r.subscription_ends_at)>new Date())?new Date(r.subscription_ends_at):new Date();
    const end=new Date(start.getTime()+days*86400000).toISOString();
    await db.batch([
      db.prepare("UPDATE restaurants SET subscription_status='active',subscription_plan=?,subscription_starts_at=?,subscription_ends_at=?,monthly_price=?,yearly_price=? WHERE id=?").bind(plan,start.toISOString(),end,MONTHLY_PRICE,YEARLY_PRICE,id),
      db.prepare("INSERT INTO payments(restaurant_id,plan,amount,paid_at,starts_at,ends_at,method,notes) VALUES(?,?,?,?,?,?,?,?)").bind(id,plan,amount,now(),start.toISOString(),end,method,notes)
    ]);
    return json({ok:true,message:"تم تجديد الاشتراك وتسجيل الدفعة",ends_at:end});
  }
  if(url.pathname.startsWith("/api/admin/stop/")&&m==="POST"){
    if(u.role!=="super_admin")return json({error:"غير مصرح"},403);const id=Number(url.pathname.split("/").pop());
    await db.prepare("UPDATE restaurants SET subscription_status='stopped' WHERE id=?").bind(id).run();return json({ok:true,message:"تم إيقاف الحجوزات"});
  }
  if(url.pathname==="/api/admin/payments"&&m==="GET"){
    if(u.role!=="super_admin")return json({error:"غير مصرح"},403);
    const payments=(await db.prepare(`SELECT p.*,r.name restaurant_name FROM payments p JOIN restaurants r ON r.id=p.restaurant_id ORDER BY p.id DESC`).all()).results;
    const totals=await db.prepare("SELECT COALESCE(SUM(amount),0) total FROM payments").first();return json({payments,total:Number(totals.total||0)});
  }
  return json({error:"المسار غير موجود"},404);
}

async function publicBooking(req,db){
  let b;try{b=await req.json()}catch{return json({error:"بيانات الحجز غير صحيحة"},400)}
  const slug=String(b.slug||"").trim(),name=String(b.customer_name||"").trim(),phone=String(b.customer_phone||"").trim(),date=String(b.booking_date||""),time=String(b.booking_time||""),party=Number(b.party_size),tableId=b.table_id?Number(b.table_id):null;
  const r=await db.prepare("SELECT * FROM restaurants WHERE slug=?").bind(slug).first();if(!r)return json({error:"المطعم غير موجود"},404);if(!activeRestaurant(r))return json({error:"الحجوزات متوقفة مؤقتًا"},403);
  if(!name||!phone||!date||!time||!Number.isInteger(party)||party<1||party>100)return json({error:"أكمل بيانات الحجز بشكل صحيح"},400);
  const sameTime=await db.prepare(`SELECT COUNT(*) n FROM bookings WHERE restaurant_id=? AND booking_date=? AND booking_time=? AND status IN ('pending','confirmed')`).bind(r.id,date,time).first();
  if(Number(sameTime.n)>=10)return json({error:"هذا الموعد ممتلئ حاليًا"},409);
  if(tableId){
    const t=await db.prepare("SELECT * FROM tables_config WHERE id=? AND restaurant_id=? AND active=1").bind(tableId,r.id).first();
    if(!t)return json({error:"الطاولة غير متاحة"},400);if(Number(t.capacity)<party)return json({error:"الطاولة المختارة لا تناسب عدد الأشخاص"},400);
    const occupied=await db.prepare(`SELECT id FROM bookings WHERE restaurant_id=? AND table_id=? AND booking_date=? AND booking_time=? AND status IN ('pending','confirmed') LIMIT 1`).bind(r.id,tableId,date,time).first();
    if(occupied)return json({error:"هذه الطاولة محجوزة في هذا الموعد"},409);
  }
  await db.prepare(`INSERT INTO bookings(restaurant_id,table_id,customer_name,customer_phone,party_size,booking_date,booking_time,status,notes) VALUES(?,?,?,?,?,?,?,?,?)`).bind(r.id,tableId,name,phone,party,date,time,"pending",String(b.notes||"").trim()).run();
  return json({ok:true,message:"تم تسجيل الحجز بنجاح. المطعم سيؤكد الحجز."});
}

function home(){return page("موعد | نظام حجز المطاعم",`<header><strong>موعد | MAW3ED</strong><nav class="nav"><a class="btn" href="/login">دخول</a><a class="btn" href="/register">ابدأ مجانًا</a></nav></header><main class="wrap"><section class="card hero"><span class="pill">نظام حجز ذكي للمطاعم والكافيهات</span><h1>موعد</h1><p>أنشئ صفحة حجز خاصة بمطعمك، أدر الطاولات والحجوزات، وتابع الاشتراك من مكان واحد.</p><div class="nav" style="justify-content:center"><a class="btn" href="/register">ابدأ تجربة ${TRIAL_DAYS} يومًا</a><a class="btn" href="/login">تسجيل الدخول</a></div></section><div class="grid"><div class="card"><h3>حجز مباشر</h3><p>رابط مستقل لكل مطعم لاستقبال الحجوزات.</p></div><div class="card"><h3>إدارة الطاولات</h3><p>حدد أسماء الطاولات وسعة كل طاولة.</p></div><div class="card"><h3>إدارة الاشتراك</h3><p>شهري ${MONTHLY_PRICE} جنيه أو سنوي ${YEARLY_PRICE} جنيه، مع تسجيل الدفعات.</p></div></div></main>`)}
function login(){return page("تسجيل الدخول",`<header><strong>موعد | تسجيل الدخول</strong></header><main class="wrap"><div class="card" style="max-width:520px;margin:auto"><h2>تسجيل الدخول</h2><input id="i" placeholder="البريد الإلكتروني أو الهاتف"><input id="p" type="password" placeholder="كلمة المرور"><button onclick="go()">دخول</button><p id="m"></p><a href="/register">إنشاء حساب جديد</a></div></main>`,`async function go(){m.textContent='جارٍ الدخول...';try{const r=await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',body:JSON.stringify({identifier:i.value,password:p.value})});const x=await r.json();if(!r.ok)throw Error(x.error||'تعذر تسجيل الدخول');location='/dashboard'}catch(e){m.className='err';m.textContent=e.message}}`)}
function register(){return page("إنشاء حساب",`<header><strong>موعد | حساب مطعم جديد</strong></header><main class="wrap"><div class="card" style="max-width:520px;margin:auto"><h2>ابدأ تجربة ${TRIAL_DAYS} يومًا</h2><input id="n" placeholder="اسم المطعم"><input id="e" type="email" placeholder="البريد الإلكتروني"><input id="ph" placeholder="رقم الهاتف"><input id="p" type="password" placeholder="كلمة المرور - 6 أحرف على الأقل"><button onclick="go()">إنشاء الحساب</button><p id="m"></p><a href="/login">لديك حساب؟ تسجيل الدخول</a></div></main>`,`async function go(){m.textContent='جارٍ إنشاء الحساب...';try{const r=await fetch('/api/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:n.value,email:e.value,phone:ph.value,password:p.value})});const x=await r.json();if(!r.ok)throw Error(x.error||'تعذر إنشاء الحساب');m.className='ok';m.textContent=x.message;setTimeout(()=>location='/login',1000)}catch(e){m.className='err';m.textContent=e.message}}`)}
function dashboard(){return page("لوحة المطعم",`<header><strong>موعد | لوحة المطعم</strong><button onclick="logout()">خروج</button></header><main class="wrap"><div class="card"><h2>بيانات المطعم</h2><div class="grid"><div><input id="name" placeholder="اسم المطعم"><input id="phone" placeholder="الهاتف"><input id="whatsapp" placeholder="واتساب"><input id="address" placeholder="العنوان"></div><div><input id="working_hours" placeholder="مواعيد العمل"><input id="logo_url" placeholder="رابط الشعار"><input id="cover_url" placeholder="رابط الغلاف"><textarea id="description" placeholder="وصف المطعم"></textarea></div></div><button onclick="save()">حفظ البيانات</button><div id="link"></div><div id="sub"></div></div><div class="grid"><div class="card"><h3>إضافة طاولة</h3><input id="tn" placeholder="اسم الطاولة"><input id="cap" type="number" min="1" value="2" placeholder="السعة"><button onclick="addTable()">إضافة</button><div id="tables"></div></div><div class="card"><h3>الحجوزات</h3><div id="bookings">تحميل...</div></div></div></main>`,`async function apiCall(u,o){const r=await fetch(u,o);const x=await r.json();if(!r.ok)throw Error(x.error||'حدث خطأ');return x}async function load(){try{const a=await apiCall('/api/restaurant');const r=a.restaurant;['name','phone','whatsapp','address','working_hours','logo_url','cover_url','description'].forEach(k=>document.getElementById(k).value=r[k]||'');link.innerHTML='<p class="success">رابط الحجز: <a target="_blank" href="/r/'+encodeURIComponent(r.slug)+'">'+location.origin+'/r/'+esc(r.slug)+'</a></p>';sub.innerHTML='<p class="notice">الحالة: <b>'+esc(r.status_text)+'</b> — ينتهي: '+esc(r.subscription_status==='active'?new Date(r.subscription_ends_at).toLocaleDateString('ar-EG'):new Date(r.trial_ends_at).toLocaleDateString('ar-EG'))+'</p>';const t=await apiCall('/api/tables');tables.innerHTML=t.tables.map(x=>'<p>'+esc(x.table_name)+' — سعة '+x.capacity+' <button class="danger" style="width:auto" onclick="del('+x.id+')">حذف</button></p>').join('')||'<p class="muted">لا توجد طاولات.</p>';const b=await apiCall('/api/bookings');bookings.innerHTML=b.bookings.length?'<table><tr><th>العميل</th><th>الموعد</th><th>الأشخاص</th><th>الطاولة</th><th>الحالة</th><th></th></tr>'+b.bookings.map(x=>'<tr><td>'+esc(x.customer_name)+'<br>'+esc(x.customer_phone)+'</td><td>'+esc(x.booking_date)+' '+esc(x.booking_time)+'</td><td>'+x.party_size+'</td><td>'+esc(x.table_name||'غير محددة')+'</td><td>'+esc(x.status)+'</td><td><select onchange="status('+x.id+',this.value)"><option value="">تغيير</option><option value="confirmed">تأكيد</option><option value="completed">مكتمل</option><option value="cancelled">إلغاء</option><option value="rejected">رفض</option><option value="pending">قيد الانتظار</option></select></td></tr>').join('')+'</table>':'<p class="muted">لا توجد حجوزات حتى الآن.</p>'}catch(e){document.getElementById('bookings').innerHTML='<p class="err">'+esc(e.message)+'</p>'}}async function save(){try{const b={};['name','phone','whatsapp','address','working_hours','logo_url','cover_url','description'].forEach(k=>b[k]=document.getElementById(k).value);await apiCall('/api/restaurant',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(b)});load()}catch(e){alert(e.message)}}async function addTable(){try{await apiCall('/api/tables',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({table_name:tn.value,capacity:cap.value})});tn.value='';load()}catch(e){alert(e.message)}}async function del(id){try{await apiCall('/api/tables/'+id,{method:'DELETE'});load()}catch(e){alert(e.message)}}async function status(id,s){if(!s)return;try{await apiCall('/api/bookings/'+id,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({status:s})});load()}catch(e){alert(e.message)}}async function logout(){await fetch('/api/logout',{method:'POST'});location='/login'}load();`)}
function admin(){return page("إدارة موعد",`<header><strong>موعد | الإدارة</strong><button onclick="logout()">خروج</button></header><main class="wrap"><div class="grid"><div class="card"><div class="muted">إجمالي المدفوعات</div><div id="total" class="stat">...</div></div><div class="card"><div class="muted">عدد المطاعم</div><div id="count" class="stat">...</div></div></div><div class="card"><h2>المطاعم والاشتراكات</h2><div id="x">تحميل...</div></div><div class="card"><h2>سجل المدفوعات</h2><div id="payments">تحميل...</div></div></main>`,`async function load(){try{const r=await fetch('/api/admin/restaurants');const x=await r.json();if(!r.ok)throw Error(x.error);count.textContent=x.restaurants.length;x.restaurants.forEach(a=>{});document.getElementById('x').innerHTML='<table><tr><th>المطعم</th><th>المالك</th><th>الحالة</th><th>الانتهاء</th><th>الحجوزات</th><th>إجراء</th></tr>'+x.restaurants.map(a=>'<tr><td>'+esc(a.name)+'<br><span class="small">/r/'+esc(a.slug)+'</span></td><td>'+esc(a.owner_name)+'<br>'+esc(a.owner_phone||'')+'</td><td>'+esc(a.status_text)+'</td><td>'+esc(a.subscription_status==='active'&&a.subscription_ends_at?new Date(a.subscription_ends_at).toLocaleDateString('ar-EG'):new Date(a.trial_ends_at).toLocaleDateString('ar-EG'))+'</td><td>'+a.booking_count+'</td><td><div class="actions"><button onclick="renew('+a.id+',\'monthly\')">تجديد شهر</button><button onclick="renew('+a.id+',\'yearly\')">تجديد سنة</button><button class="danger" onclick="stop('+a.id+')">إيقاف</button></div></td></tr>').join('')+'</table>';const p=await (await fetch('/api/admin/payments')).json();total.textContent=Number(p.total||0).toLocaleString('ar-EG')+' جنيه';payments.innerHTML=p.payments.length?'<table><tr><th>المطعم</th><th>الخطة</th><th>المبلغ</th><th>طريقة الدفع</th><th>من</th><th>إلى</th></tr>'+p.payments.map(a=>'<tr><td>'+esc(a.restaurant_name)+'</td><td>'+esc(a.plan==='yearly'?'سنوي':'شهري')+'</td><td>'+a.amount+' جنيه</td><td>'+esc(a.method||'')+'</td><td>'+new Date(a.starts_at).toLocaleDateString('ar-EG')+'</td><td>'+new Date(a.ends_at).toLocaleDateString('ar-EG')+'</td></tr>').join('')+'</table>':'<p class="muted">لا توجد مدفوعات مسجلة.</p>'}catch(e){document.getElementById('x').innerHTML='<p class="err">'+esc(e.message)+'</p>'}}async function renew(id,plan){const method=prompt('طريقة الدفع؟','نقدي')||'نقدي';const r=await fetch('/api/admin/renew/'+id,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({plan,method})});const x=await r.json();alert(x.message||x.error);if(r.ok)load()}async function stop(id){if(!confirm('إيقاف حجوزات هذا المطعم؟'))return;const r=await fetch('/api/admin/stop/'+id,{method:'POST'});const x=await r.json();alert(x.message||x.error);load()}async function logout(){await fetch('/api/logout',{method:'POST'});location='/login'}load();`)}

async function publicRestaurant(db,slug){const r=await db.prepare("SELECT * FROM restaurants WHERE slug=?").bind(slug).first();if(!r)return null;const tables=(await db.prepare("SELECT id,table_name,capacity FROM tables_config WHERE restaurant_id=? AND active=1 ORDER BY id").bind(r.id).all()).results;return {...r,tables}}
function publicPage(r){if(!activeRestaurant(r))return page(r.name,`<main class="wrap"><div class="card hero"><h1>${esc(r.name)}</h1><h2>الحجوزات متوقفة مؤقتًا</h2><p>يرجى التواصل مع إدارة المطعم.</p></div></main>`);return page(r.name,`<header><strong>${esc(r.name)}</strong></header><main class="wrap"><div class="card hero"><span class="pill">حجز مطعم</span><h1>${esc(r.name)}</h1><p>${esc(r.description||"احجز طاولتك بسهولة")}</p><p>${esc(r.address||"")} ${esc(r.phone||"")}</p><p>${esc(r.working_hours||"")}</p></div><div class="card"><h2>احجز الآن</h2><div class="grid"><div><input id="n" placeholder="الاسم"><input id="p" placeholder="رقم الهاتف"><input id="s" type="number" min="1" value="2" placeholder="عدد الأشخاص"></div><div><input id="d" type="date"><input id="t" type="time"><select id="table"><option value="">اختيار الطاولة (اختياري)</option>${r.tables.map(x=>`<option value="${x.id}">${esc(x.table_name)} — ${x.capacity} أشخاص</option>`).join('')}</select></div></div><textarea id="notes" placeholder="ملاحظات"></textarea><button onclick="book()">تأكيد الحجز</button><p id="m"></p></div></main>`,`async function book(){m.textContent='جارٍ إرسال الحجز...';const b={customer_name:n.value,customer_phone:p.value,party_size:s.value,booking_date:d.value,booking_time:t.value,table_id:table.value||null,notes:notes.value,slug:${JSON.stringify(r.slug)}};try{const rr=await fetch('/api/public-booking',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)});const x=await rr.json();if(!rr.ok)throw Error(x.error||'تعذر تسجيل الحجز');m.className='ok';m.textContent=x.message;n.value='';p.value='';notes.value=''}catch(e){m.className='err';m.textContent=e.message}}`)}

export default {async fetch(req,env){try{if(!env?.DB)return json({error:"D1 binding DB غير موجود"},500);const url=new URL(req.url);await init(env.DB);if(url.pathname.startsWith('/api/'))return api(req,url,env);if(url.pathname==='/')return home();if(url.pathname==='/login')return login();if(url.pathname==='/register')return register();if(url.pathname==='/dashboard'){const u=await currentUser(req,env.DB);if(!u)return Response.redirect(new URL('/login',url),302);return u.role==='super_admin'?admin():dashboard()}if(url.pathname.startsWith('/r/')){const r=await publicRestaurant(env.DB,decodeURIComponent(url.pathname.slice(3)));if(!r)return page('غير موجود','<main class="wrap"><div class="card"><h2>المطعم غير موجود</h2></div></main>');return publicPage(r)}if(url.pathname==='/health')return json({ok:true,service:'maw3ed',database:'maw3ed-db'});return new Response('Not Found',{status:404})}catch(e){console.error('MAW3ED_ERROR',e);return json({error:e?.message||String(e)},500)}}};
