const $ = selector => document.querySelector(selector);
const fmt = value => value.toLocaleString('ru-RU') + ' ₽';
let products = shopProducts;
let serverReady = false, submitting = false, orderToken = null, settings = {};
const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
let basket = {}, category = 'Все', lastOrder = null, toastTimer;
try {
  const saved = JSON.parse(localStorage.getItem('shoply-basket') || '{}');
  for (const [id, quantity] of Object.entries(saved || {})) {
    if (Number.isInteger(Number(id)) && Number(id)>=0 && Number.isInteger(quantity) && quantity > 0 && quantity <= 999) basket[id] = quantity;
  }
} catch (_) { /* Корзина работает в текущем сеансе, если хранение недоступно. */ }
function plural(n) {
  return n % 10 === 1 && n % 100 !== 11 ? 'товар' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'товара' : 'товаров';
}
function toast(text) {
  $('#preview-toast').textContent = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#preview-toast').textContent = '', 3000);
}
function saveBasket() {
  try { localStorage.setItem('shoply-basket', JSON.stringify(basket)); } catch (_) {}
}
function cartState() {
  const lines = Object.entries(basket).filter(([id, n]) => n > 0 && products[Number(id)]).map(([id, quantity]) => ({ ...products[Number(id)], quantity }));
  return { lines, count: lines.reduce((sum, p) => sum + p.quantity, 0), total: lines.reduce((sum, p) => sum + p.price * p.quantity, 0) };
}
function sync() {
  const active = document.activeElement;
  const focusId = active?.dataset.quantity;
  const focusDelta = active?.dataset.delta;
  const state = cartState();
  $('#cart-lines').innerHTML = state.lines.map(p => `<article class="cart-line"><a href="#product/${p.id}" class="product-photo q${p.photo}" role="img" aria-label="${escapeHTML(p.name)}"></a><div><h2><a href="#product/${p.id}">${escapeHTML(p.name)}</a></h2><div class="small muted">${fmt(p.price)} за штуку</div><div class="qty"><button data-quantity="${p.id}" data-delta="-1" aria-label="Уменьшить количество ${escapeHTML(p.name)}">−</button><span>${p.quantity}</span><button data-quantity="${p.id}" data-delta="1" aria-label="Увеличить количество ${escapeHTML(p.name)}" ${p.quantity >= 999 ? 'disabled' : ''}>+</button></div></div><b class="price">${fmt(p.price * p.quantity)}</b></article>`).join('') || '<p class="muted">Корзина пуста. <a href="#catalog">Перейти в каталог →</a></p>';
  $('#basket-count').textContent = state.count;
  $('#cart-quantity').textContent = state.count + ' ' + plural(state.count);
  document.querySelectorAll('#cart [data-total], #checkout [data-total]').forEach(el => el.textContent = fmt(state.total));
  $('#checkout-items').textContent = state.lines.map(p => p.name + ' × ' + p.quantity).join(' · ');
  $('#checkout-link').hidden = !state.count;
  document.querySelector('[form="demo-order"]').disabled = !state.count || !serverReady || submitting;
  if (focusId !== undefined) {
    const replacement = $(`[data-quantity="${focusId}"][data-delta="${focusDelta}"]`) || $('#cart-lines [data-quantity]') || $('#cart-lines a');
    replacement?.focus({ preventScroll: true });
  }
  document.querySelectorAll('#cart-lines .cart-line').forEach((el,index)=>{const p=state.lines[index];if(p.photos?.length){const photo=el.querySelector('.product-photo');photo.style.backgroundImage='url('+JSON.stringify(p.photos[0])+')';photo.style.backgroundSize='contain';photo.style.backgroundPosition='center';}});
  saveBasket();
}
function showProduct(id) {
  const p = products[id];
  if (!p) return false;
  $('#product h1').textContent = p.name;
  $('#product-crumb').textContent = p.category + ' / ' + p.name;
  $('#product .price').textContent = fmt(p.price);
  $('#product [data-add]').dataset.add = p.id;
  const visual = $('#product-visual');
  visual.className = 'product-photo q' + p.photo;
  visual.setAttribute('aria-label', p.name + ' — демонстрационная иллюстрация');
  $('#product .description').textContent = p.description || 'Описание пока не добавлено.';
  $('#product .demo').hidden = !p.demo;
  document.querySelectorAll('#product .caption').forEach(el=>el.hidden=!p.demo);
  const gallery = $('#product-gallery');
  gallery.innerHTML = '';
  p.photos?.forEach((url, index) => { const button=document.createElement('button'); button.type='button'; button.className='thumbnail'; button.setAttribute('aria-label','Фото '+(index+1)); const image=document.createElement('img'); image.src=url; image.alt=''; button.append(image); button.onclick=()=>{visual.style.backgroundImage='url('+JSON.stringify(url)+')';visual.style.backgroundSize='contain';visual.style.backgroundPosition='center';}; gallery.append(button); });
  visual.style.backgroundImage = p.photos?.length ? 'url('+JSON.stringify(p.photos[0])+')' : '';
  visual.style.backgroundSize = p.photos?.length ? 'contain' : '';
  visual.style.backgroundPosition = p.photos?.length ? 'center' : '';
  $('#product .specs').innerHTML = (p.properties || []).map(prop=>'<div><dt>'+escapeHTML(prop.name)+'</dt><dd>'+escapeHTML(prop.description)+'</dd></div>').join('');
  return true;
}
function deliveryState() {
  const pickup = document.querySelector('[name="delivery"]:checked').value === 'pickup';
  $('#address-field').hidden = pickup;
  $('#address-input').disabled = pickup;
  $('#address-input').required = !pickup;
  return pickup ? 'Самовывоз' : 'Почта';
}
function screen() {
  const parts = location.hash.slice(1).split('/');
  let id = ['catalog', 'product', 'cart', 'checkout', 'success'].includes(parts[0]) ? parts[0] : 'catalog';
  if (id === 'product' && !showProduct(Number(parts[1] || 0))) id = 'catalog';
  if (id === 'checkout' && !cartState().count) {
    location.replace('#cart');
    return;
  }
  if (id === 'success' && !lastOrder) {
    location.replace('#catalog');
    return;
  }
  document.querySelectorAll('.screen').forEach(el => el.hidden = el.id !== id);
  document.title = 'Shoply — ' + $('#' + id + ' h1').textContent;
  const heading = $('#' + id + ' h1');
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}
function filter() {
  const cards = [...document.querySelectorAll('#preview-products article')];
  let found = 0;
  cards.forEach(el => {
    const price = Number(el.dataset.price);
    el.hidden = !((category === 'Все' || el.dataset.category === category) && el.querySelector('.product-name').textContent.toLowerCase().includes($('#search-demo').value.trim().toLowerCase()) && (!$('#min-demo').value || price >= Number($('#min-demo').value)) && (!$('#max-demo').value || price <= Number($('#max-demo').value)));
    if (!el.hidden) found++;
  });
  const sort = $('#sort-demo').value;
  cards.sort((a, b) => sort === 'new' ? Number(b.dataset.id) - Number(a.dataset.id) : (sort === 'asc' ? 1 : -1) * (Number(a.dataset.price) - Number(b.dataset.price)));
  cards.forEach(card => $('#preview-products').appendChild(card));
  $('#found-demo').textContent = found + ' ' + plural(found);
  $('#no-products').hidden = found !== 0;
}
document.addEventListener('click', event => {
  let button = event.target.closest('[data-add]');
  if (button) {
    const id = Number(button.dataset.add);
    if (!products[id]) return;
    basket[id] = Math.min(999, (basket[id] || 0) + 1);
    sync();
    toast('Товар добавлен в корзину');
  }
  button = event.target.closest('[data-quantity]');
  if (button) {
    const id = button.dataset.quantity;
    basket[id] = Math.max(0, Math.min(999, (basket[id] || 0) + Number(button.dataset.delta)));
    if (!basket[id]) delete basket[id];
    sync();
  }
  button = event.target.closest('.chips [data-category]');
  if (button) {
    category = button.dataset.category;
    document.querySelectorAll('.chips button').forEach(el => el.classList.toggle('active', el === button));
    filter();
  }
});
['search-demo', 'min-demo', 'max-demo'].forEach(id => $('#' + id).addEventListener('input', () => {
  if (id === 'search-demo' && !['', '#catalog'].includes(location.hash)) {
    location.hash = 'catalog';
    // При переходе из другого экрана поиск остаётся в фокусе.
    requestAnimationFrame(() => $('#search-demo').focus());
  }
  filter();
}));
$('#sort-demo').addEventListener('change', filter);
$('#reset-demo').onclick = () => {
  category = 'Все';
  ['search-demo', 'min-demo', 'max-demo'].forEach(id => $('#' + id).value = '');
  $('#sort-demo').value = 'new';
  document.querySelectorAll('.chips button').forEach(el => el.classList.toggle('active', el.dataset.category === 'Все'));
  filter();
};
document.querySelectorAll('[name="delivery"]').forEach(el => el.addEventListener('change', deliveryState));
$('#demo-order').addEventListener('submit', async event => {
  event.preventDefault();
  const state = cartState(), form=event.currentTarget;
  if (submitting || !serverReady || !state.count || !form.reportValidity()) return;
  submitting=true; sync();
  const delivery=deliveryState();
  try { orderToken=localStorage.getItem('shoply-pending-token'); } catch (_) {}
  if (!orderToken) orderToken=crypto.randomUUID();
  try { localStorage.setItem('shoply-pending-token',orderToken); } catch (_) {}
  try {
    const fields=new FormData(form);
    const response=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:orderToken,fullname:fields.get('fullname'),phone:fields.get('phone'),delivery:fields.get('delivery'),address:fields.get('address')||'',items:state.lines.map(p=>({id:p.id,quantity:p.quantity}))})});
    const data=await response.json();
    if (!response.ok) throw new Error(data.error || 'Не удалось сохранить заказ.');
    lastOrder={number:data.id,total:data.total ?? state.total,delivery:data.delivery==='pickup'?'Самовывоз':'Почта'};
    $('#success [data-total]').textContent=fmt(lastOrder.total);
    $('#success-delivery').textContent=lastOrder.delivery;
    $('#order-number').textContent=lastOrder.number;
    basket={}; orderToken=null; try{localStorage.removeItem('shoply-pending-token');}catch(_){} sync(); form.reset(); deliveryState(); location.hash='success';
  } catch(error) { toast(error.message+' Данные формы и корзина сохранены.'); }
  finally { submitting=false;sync(); }
});
$('#support-demo').onclick=()=>{if(settings.telegram)window.open(settings.telegram,'_blank','noopener,noreferrer');else toast('Поддержка в Telegram пока не настроена.');};
window.addEventListener('hashchange', screen);
function renderCatalog(list) {
  $('#preview-products').innerHTML=list.map(p=>`<article data-id="${p.id}" data-category="${escapeHTML(p.category)}" data-price="${p.price}"><a href="#product/${p.id}" class="product-photo q${p.photo||0}" role="img" aria-label="${escapeHTML(p.name)}"></a><div class="category">${escapeHTML(p.category)}</div><a href="#product/${p.id}" class="product-name">${escapeHTML(p.name)}</a><div class="buy-row"><span class="price">${fmt(p.price)}</span><button class="button secondary" data-add="${p.id}">В корзину</button></div></article>`).join('');
  document.querySelectorAll('#preview-products article').forEach(card=>{const p=products[Number(card.dataset.id)];const photo=card.querySelector('.product-photo');if(p.photos?.length){photo.style.backgroundImage='url('+JSON.stringify(p.photos[0])+')';photo.style.backgroundSize='contain';photo.style.backgroundPosition='center';}});
  $('.chips').innerHTML='<button class="active" data-category="Все">Все товары</button>'+[...new Set(list.map(p=>p.category))].map(c=>`<button data-category="${escapeHTML(c)}">${escapeHTML(c)}</button>`).join('');
}
async function start() {
  if(location.protocol==='file:') {
    $('#connection-note').textContent='Для сохранения заказов запустите backend/server.py и откройте http://127.0.0.1:8765/. Сейчас доступен просмотр каталога.';
  } else {
    try {
      const response=await fetch('/api/shop');if(!response.ok)throw new Error('Сервер недоступен.');
      const data=await response.json();products=Object.fromEntries(data.products.map(p=>[p.id,p]));settings=data.settings;serverReady=true;
      document.documentElement.style.setProperty('--color-accent',settings.accent);document.documentElement.style.setProperty('--color-bg',settings.background);document.documentElement.style.setProperty('--color-text',settings.text);
      const logo=$('.header .logo');logo.textContent=settings.name;
      if(settings.logo){const img=document.createElement('img');img.src=settings.logo;img.alt=settings.name;img.className='brand-logo';logo.replaceChildren(img);}
      renderCatalog(data.products);
      $('#connection-note').textContent='Онлайн-оплата пока недоступна. Заказы сохраняются в магазине.';
      $('#catalog .demo').hidden=!data.products.some(p=>p.demo);
    } catch(error){$('#connection-note').textContent='Нет соединения с сервером. Оформление недоступно: '+error.message;}
  }
  $('#order-fields').disabled=!serverReady;
  sync();deliveryState();filter();screen();
}
start();
