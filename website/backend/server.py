#!/usr/bin/env python3
"""Shoply: локальный магазин. Только стандартная библиотека Python 3.10+."""
import base64, hashlib, hmac, json, mimetypes, os, re, secrets, sqlite3, time
from pathlib import Path
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from http.cookies import SimpleCookie
from urllib.parse import urlsplit, unquote

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
DATA = Path(os.environ.get('SHOPLY_DATA_DIR', str(ROOT / 'var/data')))
STATUSES = ['Ожидает оплаты', 'В работе', 'Отправлен', 'Завершён', 'Отменён']
SESSIONS, ATTEMPTS = {}, {}
DEFAULT = dict(name='Shoply', logo='', accent='#2864e8', background='#ffffff', text='#182231', telegram='')

def connect():
    db = sqlite3.connect(DATA / 'shoply.sqlite3', timeout=15)
    db.row_factory = sqlite3.Row
    return db

def init():
    DATA.mkdir(parents=True, exist_ok=True)
    with connect() as db:
        db.executescript('''CREATE TABLE IF NOT EXISTS config(key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY AUTOINCREMENT, body TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
        CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT UNIQUE NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL, created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);''')
        if not db.execute("SELECT 1 FROM config WHERE key='settings'").fetchone():
            db.execute('INSERT INTO config VALUES(?,?)', ('settings', json.dumps(DEFAULT)))
        if not db.execute("SELECT 1 FROM config WHERE key='seeded'").fetchone():
            seed = json.loads((PUBLIC / 'assets/js/products.js').read_text().split('=',1)[1].strip().rstrip(';'))
            for p in seed:
                p.update(description='Демонстрационный товар Shoply. Замените описание и фотографии в админке.', properties=[], photos=[], demo=True)
                db.execute('INSERT INTO products(id,body) VALUES(?,?)', (p['id'], json.dumps(p, ensure_ascii=False)))
            db.execute('INSERT INTO config VALUES(?,?)', ('seeded','true'))

def config(db, key):
    row = db.execute('SELECT value FROM config WHERE key=?', (key,)).fetchone()
    return json.loads(row['value']) if row else None

def text(value, limit=1000, required=False):
    if not isinstance(value, str) or len(value) > limit or (required and not value.strip()):
        raise ValueError('Проверьте обязательные поля и длину текста.')
    return value.strip()

def image_path(value):
    value = text(value, 300)
    if value and not re.fullmatch(r'assets/(?:uploads/[a-f0-9]+|images/[a-z0-9-]+)\.(?:png|jpg|webp)', value):
        raise ValueError('Недопустимый путь изображения.')
    return value

def product_body(body):
    p = dict(name=text(body.get('name'),160,True), category=text(body.get('category'),100,True), description=text(body.get('description',''),10000), demo=bool(body.get('demo',False)))
    price = body.get('price')
    if isinstance(price,bool) or not isinstance(price,(int,float)) or not 0 < price <= 100000000 or round(price,2) != price:
        raise ValueError('Цена должна быть положительной, максимум два знака после запятой.')
    p['price'] = price
    p['photo'] = int(body.get('photo',0)) % 4
    photos, props = body.get('photos',[]), body.get('properties',[])
    if not isinstance(photos,list) or len(photos)>12 or not isinstance(props,list) or len(props)>40:
        raise ValueError('Максимум 12 фото и 40 свойств.')
    p['photos'] = [image_path(x) for x in photos if x]
    p['properties'] = [{'name':text(x.get('name'),100,True),'description':text(x.get('description',''),2000)} for x in props]
    return p

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def json(self, code, body, cookie=None):
        raw=json.dumps(body,ensure_ascii=False).encode()
        self.send_response(code); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Cache-Control','no-store')
        if cookie: self.send_header('Set-Cookie',cookie)
        self.send_header('Content-Length',str(len(raw)));self.send_header('X-Content-Type-Options','nosniff');self.end_headers();self.wfile.write(raw)
    def authenticated(self):
        try:
            cookies=SimpleCookie(self.headers.get('Cookie','')); token=cookies['shoply_session'].value
            return SESSIONS.get(token,0)>time.time()
        except (KeyError,ValueError): return False
    def do_GET(self):
        path=unquote(urlsplit(self.path).path)
        with connect() as db:
            if path=='/api/shop':
                products=[dict(json.loads(r['body']),id=r['id']) for r in db.execute('SELECT id,body FROM products WHERE active=1 ORDER BY id DESC')]
                return self.json(200,dict(products=products,settings=config(db,'settings')))
            if path=='/api/session':return self.json(200,dict(authenticated=self.authenticated(),setup=config(db,'admin') is None))
            if path=='/api/admin/orders':
                if not self.authenticated():return self.json(401,dict(error='Войдите в админку.'))
                return self.json(200,dict(orders=[dict(id=r['id'],status=r['status'],created=r['created'],**json.loads(r['body'])) for r in db.execute('SELECT * FROM orders ORDER BY id DESC')],statuses=STATUSES))
        if path.startswith('/api/'):return self.json(404,dict(error='Не найдено.'))
        relative='index.html' if path=='/' else path.lstrip('/')
        allowed = relative in {'index.html','admin.html'} or (relative.startswith('assets/') and relative.endswith(('.css','.js','.png','.jpg','.webp','.woff2')))
        file=(PUBLIC/relative).resolve()
        if not allowed or not file.is_relative_to(PUBLIC) or not file.is_file():return self.json(404,dict(error='Не найдено.'))
        raw=file.read_bytes();self.send_response(200);self.send_header('Content-Type',mimetypes.guess_type(str(file))[0] or 'application/octet-stream');self.send_header('Content-Length',str(len(raw)));self.send_header('Cache-Control','no-cache');self.send_header('X-Content-Type-Options','nosniff');self.send_header('Referrer-Policy','same-origin');self.end_headers();self.wfile.write(raw)
    def do_POST(self): self.mutate()
    def do_DELETE(self): self.mutate()
    def mutate(self):
        try:
            host=self.headers.get('Host','')
            if host not in {f'127.0.0.1:{self.server.server_port}',f'localhost:{self.server.server_port}'}:return self.json(403,dict(error='Недопустимый адрес сервера.'))
            origin=self.headers.get('Origin')
            if origin and origin != 'http://'+host:return self.json(403,dict(error='Недопустимый источник запроса.'))
            if not self.headers.get('Content-Type','').startswith('application/json'):return self.json(415,dict(error='Ожидается JSON.'))
            size=int(self.headers.get('Content-Length','0'))
            if size<1 or size>9000000: return self.json(413,dict(error='Слишком большой запрос.'))
            body=json.loads(self.rfile.read(size))
            if not isinstance(body,dict):raise ValueError('Ожидается объект.')
            path=urlsplit(self.path).path
            with connect() as db:
                if path in ('/api/setup','/api/login'):
                    now=time.time(); ip=self.client_address[0]; attempts=[t for t in ATTEMPTS.get(ip,[]) if t>now-300]
                    if len(attempts)>=10:return self.json(429,dict(error='Слишком много попыток. Повторите через 5 минут.'))
                    ATTEMPTS[ip]=attempts+[now]
                    admin=config(db,'admin'); password=text(body.get('password'),256,True); username=text(body.get('username'),80,True)
                    if path=='/api/setup':
                        if admin:return self.json(409,dict(error='Администратор уже создан.'))
                        if len(password)<10:raise ValueError('Пароль должен содержать минимум 10 символов.')
                        salt=secrets.token_hex(16); digest=hashlib.scrypt(password.encode(),salt=bytes.fromhex(salt),n=16384,r=8,p=1).hex()
                        db.execute("INSERT INTO config VALUES('admin',?)",(json.dumps(dict(username=username,salt=salt,digest=digest)),))
                    elif not admin or not hmac.compare_digest(username.encode(),admin['username'].encode()) or not hmac.compare_digest(hashlib.scrypt(password.encode(),salt=bytes.fromhex(admin['salt']),n=16384,r=8,p=1).hex(),admin['digest']):return self.json(401,dict(error='Неверный логин или пароль.'))
                    ATTEMPTS.pop(ip,None); token=secrets.token_urlsafe(32);SESSIONS[token]=now+43200
                    return self.json(200,dict(ok=True),f'shoply_session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200')
                if path=='/api/orders':
                    token=text(body.get('token'),100,True)
                    existing=db.execute('SELECT id,status,body FROM orders WHERE token=?',(token,)).fetchone()
                    if existing:
                        saved=json.loads(existing['body'])
                        return self.json(200,dict(id=existing['id'],status=existing['status'],total=saved['total'],delivery=saved['delivery']))
                    customer=dict(fullname=text(body.get('fullname'),160,True),phone=text(body.get('phone'),30,True))
                    if not 7<=len(re.sub(r'\D','',customer['phone']))<=15:raise ValueError('Укажите корректный номер телефона.')
                    delivery=body.get('delivery')
                    if delivery not in ('post','pickup'):raise ValueError('Выберите способ доставки.')
                    address=text(body.get('address',''),400,delivery=='post') if delivery=='post' else ''
                    requested=body.get('items'); lines=[];seen=set()
                    if not isinstance(requested,list) or not 1<=len(requested)<=100:raise ValueError('Корзина пуста или слишком велика.')
                    for item in requested:
                        pid=item.get('id'); qty=item.get('quantity')
                        if type(pid) is not int or type(qty) is not int or not 1<=qty<=999 or pid in seen:raise ValueError('Некорректный состав заказа.')
                        seen.add(pid);row=db.execute('SELECT body FROM products WHERE id=? AND active=1',(pid,)).fetchone()
                        if not row:raise ValueError('Один из товаров недоступен. Обновите каталог.')
                        p=json.loads(row['body']); lines.append(dict(id=pid,name=p['name'],price=p['price'],quantity=qty))
                    total=round(sum(p['price']*p['quantity'] for p in lines),2)
                    order=dict(customer=customer,delivery=delivery,address=address,items=lines,total=total)
                    cur=db.execute('INSERT INTO orders(token,body,status) VALUES(?,?,?)',(token,json.dumps(order,ensure_ascii=False),STATUSES[0]))
                    return self.json(201,dict(id=cur.lastrowid,status=STATUSES[0],total=total,delivery=delivery))
                if not self.authenticated():return self.json(401,dict(error='Войдите в админку.'))
                if path=='/api/logout':
                    c=SimpleCookie(self.headers.get('Cookie',''));SESSIONS.pop(c['shoply_session'].value,None)
                    return self.json(200,dict(ok=True),'shoply_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0')
                if path=='/api/admin/settings':
                    settings=dict(name=text(body.get('name'),80,True),logo=image_path(body.get('logo','')),telegram=text(body.get('telegram',''),200))
                    if settings['telegram'] and not re.fullmatch(r'https://t\.me/[A-Za-z0-9_+/-]+',settings['telegram']):raise ValueError('Ссылка поддержки должна начинаться с https://t.me/.')
                    for key in ('accent','background','text'):
                        value=body.get(key,'')
                        if not isinstance(value,str) or not re.fullmatch(r'#[0-9a-fA-F]{6}',value):raise ValueError('Некорректный цвет.')
                        settings[key]=value
                    db.execute("UPDATE config SET value=? WHERE key='settings'",(json.dumps(settings,ensure_ascii=False),));return self.json(200,dict(ok=True))
                if path=='/api/admin/products':
                    pid=body.get('id')
                    if self.command=='DELETE':
                        db.execute('UPDATE products SET active=0 WHERE id=?',(pid,));return self.json(200,dict(ok=True))
                    p=product_body(body)
                    if pid is None:
                        cur=db.execute('INSERT INTO products(body) VALUES(?)',(json.dumps(p,ensure_ascii=False),));pid=cur.lastrowid
                    else:
                        if not db.execute('SELECT 1 FROM products WHERE id=? AND active=1',(pid,)).fetchone():raise ValueError('Товар не найден.')
                        db.execute('UPDATE products SET body=? WHERE id=?',(json.dumps(p,ensure_ascii=False),pid))
                    return self.json(200,dict(ok=True,id=pid))
                if path=='/api/admin/orders':
                    status=body.get('status')
                    if status not in STATUSES:raise ValueError('Недопустимый статус.')
                    db.execute('UPDATE orders SET status=? WHERE id=?',(status,body.get('id')));return self.json(200,dict(ok=True))
                if path=='/api/admin/upload':
                    raw=base64.b64decode(body.get('data',''),validate=True)
                    if len(raw)>6000000:raise ValueError('Максимальный размер фото — 6 МБ.')
                    ext='png' if raw.startswith(b'\x89PNG\r\n\x1a\n') else 'jpg' if raw.startswith(b'\xff\xd8\xff') else 'webp' if raw[:4]==b'RIFF' and raw[8:12]==b'WEBP' else None
                    if not ext:raise ValueError('Поддерживаются PNG, JPEG и WebP.')
                    name=f'assets/uploads/{secrets.token_hex(16)}.{ext}';(PUBLIC/'assets/uploads').mkdir(exist_ok=True);(PUBLIC/name).write_bytes(raw)
                    return self.json(201,dict(path=name))
                return self.json(404,dict(error='Не найдено.'))
        except (ValueError,TypeError,KeyError,AttributeError,OverflowError) as exc:
            return self.json(400,dict(error=str(exc) if isinstance(exc,ValueError) else 'Проверьте данные запроса.'))
        except sqlite3.IntegrityError:
            return self.json(409,dict(error='Повторный запрос. Обновите страницу.'))
        except Exception:
            return self.json(500,dict(error='Ошибка сохранения. Попробуйте ещё раз.'))

if __name__=='__main__':
    init();port=int(os.environ.get('SHOPLY_PORT','8765'))
    server=ThreadingHTTPServer(('127.0.0.1',port),Handler)
    print(f'Shoply: http://127.0.0.1:{port}/  Админка: /admin.html',flush=True)
    server.serve_forever()
