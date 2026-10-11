import base64, http.cookiejar, importlib.util, json, os, socket, subprocess, sys, tempfile, time, unittest
from pathlib import Path
from urllib.request import build_opener, HTTPCookieProcessor, Request, urlopen
from urllib.error import HTTPError
ROOT=Path(__file__).resolve().parents[1]
class ShopTest(unittest.TestCase):
 def test_full_shop_and_restart(self):
  with tempfile.TemporaryDirectory() as data:
   with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
   base=f'http://127.0.0.1:{port}';env=dict(os.environ,SHOPLY_DATA_DIR=data,SHOPLY_PORT=str(port));process=None;uploaded=None
   opener=build_opener(HTTPCookieProcessor(http.cookiejar.CookieJar()))
   def start():
    p=subprocess.Popen([sys.executable,str(ROOT/'backend/server.py')],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    for _ in range(100):
     try:urlopen(base+'/api/session',timeout=.2);return p
     except Exception:
      if p.poll() is not None:raise RuntimeError(p.stderr.read().decode())
      time.sleep(.03)
    p.terminate();raise RuntimeError('Server startup timeout')
   def call(path,body=None,auth=True,method=None,origin=None):
    headers={'Content-Type':'application/json'}
    if origin:headers['Origin']=origin
    req=Request(base+path,data=json.dumps(body).encode() if body is not None else None,headers=headers,method=method)
    try:
     with (opener.open(req) if auth else urlopen(req)) as r:return r.status,json.load(r)
    except HTTPError as e:return e.code,json.load(e)
   try:
    process=start()
    self.assertEqual(call('/api/admin/orders',auth=False)[0],401)
    self.assertEqual(call('/data/shoply.sqlite3',auth=False)[0],404)
    self.assertEqual(call('/server.py',auth=False)[0],404)
    for path in ['/backend/server.py','/var/data/shoply.sqlite3','/codex/BRIEF.md','/assets/css/store.css','/assets/js/store.js','/assets/fonts/InterVariable.woff2']:
     if path.startswith('/assets/'):
      with urlopen(base+path) as resource:self.assertEqual(resource.status,200)
     else:self.assertEqual(call(path,auth=False)[0],404)
    self.assertEqual(call('/api/setup',{'username':'тест-админ','password':'test-password-123'},origin='https://evil.example')[0],403)
    self.assertEqual(call('/api/setup',{'username':'тест-админ','password':'test-password-123'})[0],200)
    self.assertEqual(call('/api/setup',{'username':'other','password':'test-password-123'})[0],409)
    self.assertEqual(call('/api/shop')[1]['products'].__len__(),22)
    p=dict(name='Тестовый товар',category='Новая категория',price=123.45,description='<script>test</script>',properties=[dict(name='Любое свойство',description='Любое описание')],photos=[],demo=True)
    code,saved=call('/api/admin/products',p);self.assertEqual(code,200);pid=saved['id']
    p['id']=pid;p['price']=99.50;self.assertEqual(call('/api/admin/products',p)[0],200)
    image=base64.b64encode((ROOT/'public/assets/images/shoply-product.jpg').read_bytes()).decode()
    code,uploaded=call('/api/admin/upload',{'data':image});self.assertEqual(code,201)
    p['photos']=[uploaded['path']];self.assertEqual(call('/api/admin/products',p)[0],200)
    settings=dict(name='Shoply Test',logo=uploaded['path'],accent='#0066ff',background='#ffffff',text='#222222',telegram='https://t.me/test')
    self.assertEqual(call('/api/admin/settings',settings)[0],200)
    bad=dict(settings,telegram='javascript:alert(1)');self.assertEqual(call('/api/admin/settings',bad)[0],400)
    order=dict(token='test-request-123',fullname='Тестовый покупатель',phone='+7 999 123 45 67',delivery='pickup',address='Не сохранять',items=[dict(id=pid,quantity=2,price=.01)],total=.02)
    code,created=call('/api/orders',order,auth=False);self.assertEqual(code,201);oid=created['id'];self.assertEqual(created['total'],199)
    retry=call('/api/orders',dict(order,delivery='post',address='Другой адрес'),auth=False)[1]
    self.assertEqual(retry['id'],oid);self.assertEqual(retry['total'],199);self.assertEqual(retry['delivery'],'pickup')
    orders=call('/api/admin/orders')[1]['orders'];self.assertEqual(len(orders),1);self.assertEqual(orders[0]['address'],'');self.assertEqual(orders[0]['total'],199)
    self.assertEqual(call('/api/admin/orders',{'id':oid,'status':'В работе'})[0],200)
    invalid=dict(order,token='other',delivery='post',address='');self.assertEqual(call('/api/orders',invalid,auth=False)[0],400)
    self.assertEqual(call('/api/admin/products',{'id':pid},method='DELETE')[0],200)
    self.assertEqual(call('/api/admin/orders')[1]['orders'][0]['items'][0]['name'],'Тестовый товар')
    process.terminate();process.wait();process.stderr.close();process=start()
    self.assertEqual(call('/api/admin/orders')[0],401)
    self.assertEqual(call('/api/login',{'username':'тест-админ','password':'test-password-123'})[0],200)
    self.assertEqual(call('/api/shop')[1]['settings']['name'],'Shoply Test')
    self.assertEqual(call('/api/admin/orders')[1]['orders'][0]['status'],'В работе')
    self.assertNotIn(pid,[p['id'] for p in call('/api/shop')[1]['products']])
    self.assertEqual(call('/api/logout',{})[0],200)
    self.assertEqual(call('/api/admin/orders')[0],401)
   finally:
    if process:process.terminate();process.wait();process.stderr.close()
    if uploaded and 'path' in uploaded:(ROOT/'public'/uploaded['path']).unlink(missing_ok=True)
if __name__=='__main__':unittest.main()
