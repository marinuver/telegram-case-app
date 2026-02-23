let adminTab = 'stats';
let adminLoading = false;
let adminStats = null;

async function renderAdmin() {
  if (!currentUser || !currentUser.is_admin) {
    document.getElementById('mainContent').innerHTML = '<div class="page"><div class="empty-state"><div class="empty-state-title">Доступ запрещён</div></div></div>';
    return;
  }

  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div class="page">
      <div class="admin-tabs" id="adminTabs">
        <button class="admin-tab ${adminTab === 'stats' ? 'active' : ''}" onclick="switchAdminTab('stats')">
          ${ICONS.chart}<span>Статистика</span>
        </button>
        <button class="admin-tab ${adminTab === 'orders' ? 'active' : ''}" onclick="switchAdminTab('orders')">
          ${ICONS.orders}<span>Заказы</span>
        </button>
        <button class="admin-tab ${adminTab === 'categories' ? 'active' : ''}" onclick="switchAdminTab('categories')">
          ${ICONS.folder}<span>Категории</span>
        </button>
        <button class="admin-tab ${adminTab === 'products' ? 'active' : ''}" onclick="switchAdminTab('products')">
          ${ICONS.box}<span>Товары</span>
        </button>
        <button class="admin-tab ${adminTab === 'cases' ? 'active' : ''}" onclick="switchAdminTab('cases')">
          ${ICONS.gift}<span>Кейсы</span>
        </button>
        <button class="admin-tab ${adminTab === 'promos' ? 'active' : ''}" onclick="switchAdminTab('promos')">
          ${ICONS.tag}<span>Промо</span>
        </button>
        <button class="admin-tab ${adminTab === 'users' ? 'active' : ''}" onclick="switchAdminTab('users')">
          ${ICONS.users}<span>Юзеры</span>
        </button>
        <button class="admin-tab ${adminTab === 'broadcast' ? 'active' : ''}" onclick="switchAdminTab('broadcast')">
          ${ICONS.send}<span>Рассылка</span>
        </button>
        <button class="admin-tab ${adminTab === 'settings' ? 'active' : ''}" onclick="switchAdminTab('settings')">
          ${ICONS.admin}<span>Настройки</span>
        </button>
      </div>
      <div id="adminContent"><div class="loading-spinner"><div class="spinner"></div></div></div>
    </div>
  `;

  await loadAdminTab();
}

async function switchAdminTab(tab) {
  if (adminLoading) return;
  adminTab = tab;
  document.querySelectorAll('.admin-tab').forEach(el => {
    el.classList.toggle('active', el.textContent.trim().toLowerCase().includes(
      tab === 'stats' ? 'стат' : tab === 'orders' ? 'заказ' : tab === 'categories' ? 'катег' :
        tab === 'products' ? 'товар' : tab === 'cases' ? 'кейс' : tab === 'promos' ? 'промо' : 
        tab === 'broadcast' ? 'рассыл' : 'юзер'
    ));
  });
  const tabs = document.querySelectorAll('.admin-tab');
  const tabMap = ['stats', 'orders', 'categories', 'products', 'cases', 'promos', 'users', 'broadcast', 'settings'];
  tabs.forEach((el, i) => el.classList.toggle('active', tabMap[i] === tab));

  document.getElementById('adminContent').innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
  await loadAdminTab();
}

async function loadAdminTab() {
  if (adminLoading) return;
  adminLoading = true;
  const container = document.getElementById('adminContent');

  try {
    switch (adminTab) {
      case 'stats': await renderAdminStats(container); break;
      case 'orders': await renderAdminOrders(container); break;
      case 'categories': await renderAdminCategories(container); break;
      case 'products': await renderAdminProducts(container); break;
      case 'cases': await renderAdminCases(container); break;
      case 'promos': await renderAdminPromos(container); break;
      case 'users': await renderAdminUsers(container); break;
      case 'broadcast': await renderAdminBroadcast(container); break;
      case 'settings': await renderAdminSettings(container); break;
    }
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-text">Ошибка загрузки: ${e.message}</div></div>`;
  }
  adminLoading = false;
}

async function renderAdminStats(container) {
  adminStats = await apiCall('/api/stats');
  const s = adminStats;

  container.innerHTML = `
    <div class="admin-fade-in">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">${ICONS.users}</div>
          <div class="stat-label">Пользователи</div>
          <div class="stat-value">${s.users.total}</div>
          <div class="stat-sub">+${s.users.day} сегодня</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">${ICONS.orders}</div>
          <div class="stat-label">Заказы</div>
          <div class="stat-value">${s.sales.total.count}</div>
          <div class="stat-sub">+${s.sales.day.count} сегодня</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">${ICONS.revenue}</div>
          <div class="stat-label">Выручка</div>
          <div class="stat-value">${formatPrice(s.financial.revenue)} ₽</div>
          <div class="stat-sub">+${formatPrice(s.sales.day.sum)} ₽ сегодня</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">${ICONS.eye}</div>
          <div class="stat-label">Визиты</div>
          <div class="stat-value">${s.visits.total}</div>
          <div class="stat-sub">+${s.visits.day} сегодня</div>
        </div>
      </div>

      <div class="stats-section">
        <div class="stats-section-title">${ICONS.trending} Продажи</div>
        <div class="stats-table">
          <div class="stats-row"><span class="stats-row-label">Сегодня</span><span class="stats-row-value">${s.sales.day.count} / ${formatPrice(s.sales.day.sum)} ₽</span></div>
          <div class="stats-row"><span class="stats-row-label">За неделю</span><span class="stats-row-value">${s.sales.week.count} / ${formatPrice(s.sales.week.sum)} ₽</span></div>
          <div class="stats-row"><span class="stats-row-label">За месяц</span><span class="stats-row-value">${s.sales.month.count} / ${formatPrice(s.sales.month.sum)} ₽</span></div>
          <div class="stats-row"><span class="stats-row-label">Всего</span><span class="stats-row-value">${s.sales.total.count} / ${formatPrice(s.sales.total.sum)} ₽</span></div>
        </div>
      </div>

      <div class="stats-section">
        <div class="stats-section-title">${ICONS.box} Каталог</div>
        <div class="stats-table">
          <div class="stats-row"><span class="stats-row-label">Категорий</span><span class="stats-row-value">${s.products.categories}</span></div>
          <div class="stats-row"><span class="stats-row-label">Товаров</span><span class="stats-row-value">${s.products.count}</span></div>
          <div class="stats-row"><span class="stats-row-label">Промокодов</span><span class="stats-row-value">${s.products.promos}</span></div>
        </div>
      </div>
    </div>
  `;
}

async function renderAdminOrders(container) {
  const orders = await apiCall('/api/orders/all');

  if (!orders.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${ICONS.orders}</div><div class="empty-state-title">Нет заказов</div></div>`;
    return;
  }

  container.innerHTML = `
    <div class="admin-fade-in">
      ${orders.map((order, i) => {
    const customerName = order.first_name ? (order.first_name + (order.username ? ` (@${order.username})` : '')) : `ID: ${order.customer_tg_id || order.user_id}`;
    const itemsList = (order.items || []).map(it => `${it.product_name || 'Товар'} × ${it.quantity}`).join(', ');
    return `
          <div class="order-admin-card" style="animation: itemSlideIn 0.3s ease ${i * 0.04}s both">
            <div class="order-admin-header">
              <div>
                <div class="order-admin-number">Заказ #${order.id}</div>
                <div class="order-admin-customer">${ICONS.profile} ${escapeHtml(customerName)}</div>
              </div>
              <span class="order-status status-${order.status}">${getStatusLabel(order.status)}</span>
            </div>
            <div class="order-admin-items">${escapeHtml(itemsList)}</div>
            <div class="order-admin-footer">
              <span class="order-admin-date">${formatDate(order.created_at)}</span>
              <span class="order-admin-total">${formatPrice(order.total)} ₽</span>
              ${order.status === 'pending' ? `
                <div class="order-admin-actions">
                  <button class="icon-btn success" title="Завершить" onclick="updateOrderStatus(${order.id},'completed')">
                    ${ICONS.check}
                  </button>
                  <button class="icon-btn danger" title="Отклонить" onclick="updateOrderStatus(${order.id},'cancelled')">
                    ${ICONS.close}
                  </button>
                </div>
              ` : ''}
            </div>
          </div>
        `;
  }).join('')}
    </div>
  `;
}

async function updateOrderStatus(orderId, status) {
  try {
    await apiCall(`/api/orders/${orderId}/status`, 'PUT', { status });
    showToast(status === 'completed' ? 'Заказ завершён' : 'Заказ отклонён', 'success');
    await loadAdminTab();
  } catch (e) {
    showToast(e.message || 'Ошибка', 'error');
  }
}

async function renderAdminCategories(container) {
  const categories = await apiCall('/api/categories');

  container.innerHTML = `
    <div class="admin-fade-in">
      <div class="admin-list" id="categoriesList">
        ${categories.map((cat, i) => `
          <div class="admin-list-item" draggable="true" data-id="${cat.id}" data-sort="${cat.sort_order}"
               ondragstart="onDragStart(event)" ondragover="onDragOver(event)" ondrop="onDrop(event)" ondragend="onDragEnd(event)"
               style="animation: itemSlideIn 0.3s ease ${i * 0.04}s both">
            <div class="drag-handle">${ICONS.drag}</div>
            <div class="item-content">
              <div class="item-title">${escapeHtml(cat.name)}</div>
              <div class="item-sub">ID: ${cat.id}</div>
            </div>
            <div class="item-actions">
              <button class="icon-btn" onclick="editCategory(${cat.id},'${escapeHtml(cat.name)}')">${ICONS.edit}</button>
              <button class="icon-btn danger" onclick="deleteCategory(${cat.id})">${ICONS.trash}</button>
            </div>
          </div>
        `).join('')}
      </div>
      <button class="admin-add-btn" onclick="addCategory()">
        ${ICONS.plus} Добавить категорию
      </button>
    </div>
  `;
}

let draggedEl = null;
function onDragStart(e) { draggedEl = e.currentTarget; e.currentTarget.classList.add('dragging'); }
function onDragEnd(e) { e.currentTarget.classList.remove('dragging'); draggedEl = null; document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over')); }
function onDragOver(e) { e.preventDefault(); const target = e.currentTarget; if (target !== draggedEl) target.classList.add('drag-over'); }
function onDrop(e) {
  e.preventDefault();
  const target = e.currentTarget;
  target.classList.remove('drag-over');
  if (!draggedEl || target === draggedEl) return;
  const list = document.getElementById('categoriesList');
  const items = [...list.children];
  const fromIndex = items.indexOf(draggedEl);
  const toIndex = items.indexOf(target);
  if (fromIndex < toIndex) { target.after(draggedEl); } else { target.before(draggedEl); }
  saveOrder();
}

async function saveOrder() {
  const items = [...document.querySelectorAll('#categoriesList .admin-list-item')];
  const order = items.map((el, i) => ({ id: parseInt(el.dataset.id), sort_order: i + 1 }));
  try {
    await apiCall('/api/categories/reorder/all', 'PUT', { order });
  } catch (e) { showToast('Ошибка сортировки', 'error'); }
}

function addCategory() {
  openModal('Новая категория', `
    <div class="form-group">
      <label class="form-label">Название</label>
      <input class="form-input" id="catName" placeholder="Введите название">
    </div>
    <button class="btn-primary" onclick="saveNewCategory()">Создать</button>
  `);
}

async function saveNewCategory() {
  const name = document.getElementById('catName').value.trim();
  if (!name) return showToast('Введите название', 'error');
  try {
    await apiCall('/api/categories', 'POST', { name });
    closeModal();
    showToast('Категория создана', 'success');
    setTimeout(() => loadAdminTab(), 250);
  } catch (e) { showToast(e.message, 'error'); }
}

function editCategory(id, name) {
  openModal('Редактировать', `
    <div class="form-group">
      <label class="form-label">Название</label>
      <input class="form-input" id="editCatName" value="${name}">
    </div>
    <button class="btn-primary" onclick="saveEditCategory(${id})">Сохранить</button>
  `);
}

async function saveEditCategory(id) {
  const name = document.getElementById('editCatName').value.trim();
  if (!name) return showToast('Введите название', 'error');
  try {
    await apiCall(`/api/categories/${id}`, 'PUT', { name });
    closeModal();
    showToast('Сохранено', 'success');
    setTimeout(() => loadAdminTab(), 250);
  } catch (e) { showToast(e.message, 'error'); }
}

async function deleteCategory(id) {
  if (!confirm('Удалить категорию?')) return;
  try {
    await apiCall(`/api/categories/${id}`, 'DELETE');
    showToast('Удалено', 'success');
    await loadAdminTab();
  } catch (e) { showToast(e.message, 'error'); }
}

async function renderAdminProducts(container) {
  const products = await apiCall('/api/products');

  container.innerHTML = `
    <div class="admin-fade-in">
      ${products.map((p, i) => `
        <div class="admin-product-card" style="animation: itemSlideIn 0.3s ease ${i * 0.04}s both">
          <div class="admin-product-thumb">
            ${p.image_url
      ? `<img src="${p.image_url}" alt="">`
      : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#333">${ICONS.box}</div>`
    }
          </div>
          <div class="admin-product-info">
            <div class="admin-product-name">${escapeHtml(p.name)}</div>
            <div class="admin-product-meta">${p.category_name || '—'} • ${p.stock === -1 ? '∞' : p.stock + ' шт.'}</div>
            <div class="admin-product-price">${formatPrice(p.price)} ₽</div>
          </div>
          <div class="admin-product-actions">
            <button class="icon-btn" onclick="editProduct(${p.id})">${ICONS.edit}</button>
            <button class="icon-btn danger" onclick="deleteProduct(${p.id})">${ICONS.trash}</button>
          </div>
        </div>
      `).join('')}
      <button class="admin-add-btn" onclick="addProduct()" style="margin-top:8px">
        ${ICONS.plus} Добавить товар
      </button>
    </div>
  `;
}

function addProduct() {
  showProductForm();
}

async function editProduct(id) {
  try {
    const product = await apiCall(`/api/products/${id}`);
    showProductForm(product);
  } catch (e) { showToast('Ошибка загрузки', 'error'); }
}

async function showProductForm(product = null) {
  const categories = await apiCall('/api/categories');
  const isEdit = !!product;

  openModal(isEdit ? 'Редактировать' : 'Новый товар', `
    <div class="form-group">
      <label class="form-label">Название</label>
      <input class="form-input" id="prodName" value="${product ? escapeHtml(product.name) : ''}">
    </div>
    <div class="form-group">
      <label class="form-label">Описание</label>
      <textarea class="form-textarea" id="prodDesc">${product ? escapeHtml(product.description || '') : ''}</textarea>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Цена (₽)</label>
        <input class="form-input" type="number" id="prodPrice" value="${product ? product.price : ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Цена (⭐ звёзды)</label>
        <input class="form-input" type="number" id="prodStarsPrice" value="${product ? (product.stars_price || 0) : ''}" placeholder="0">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Категория</label>
      <select class="form-select" id="prodCategory">
        <option value="">Без категории</option>
        ${categories.map(c => `<option value="${c.id}" ${product && product.category_id == c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Изображение</label>
      <div class="image-upload-tabs">
        <button class="image-upload-tab active" onclick="switchImgTab('file',this)">С устройства</button>
        <button class="image-upload-tab" onclick="switchImgTab('url',this)">По ссылке</button>
      </div>
      <div id="imgUploadFile">
        <div class="image-upload-area ${product && product.image_url ? 'has-image' : ''}" onclick="document.getElementById('prodImage').click()" id="imgPreviewArea">
          ${product && product.image_url
      ? `<img src="${product.image_url}" id="imgPreview">`
      : `<div class="image-upload-icon">${ICONS.image}</div><div class="image-upload-text">Нажмите для загрузки</div><div class="image-upload-sub">JPG, PNG до 10 МБ</div>`
    }
        </div>
        <input type="file" id="prodImage" accept="image/*" style="display:none" onchange="previewImg(this)">
      </div>
      <div id="imgUploadUrl" style="display:none">
        <input class="form-input" id="prodImageUrl" placeholder="https://..." value="${product && product.image_url && product.image_url.startsWith('http') ? product.image_url : ''}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Количество (−1 = безлимит)</label>
      <input class="form-input" type="number" id="prodStock" value="${product ? product.stock : -1}" min="-1">
    </div>
    <button class="btn-primary" onclick="saveProduct(${isEdit ? product.id : 'null'})">${isEdit ? 'Сохранить' : 'Создать'}</button>
  `);
}

function switchImgTab(tab, btn) {
  document.getElementById('imgUploadFile').style.display = tab === 'file' ? '' : 'none';
  document.getElementById('imgUploadUrl').style.display = tab === 'url' ? '' : 'none';
  document.querySelectorAll('.image-upload-tab').forEach(el => el.classList.remove('active'));
  btn.classList.add('active');
}

function previewImg(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const area = document.getElementById('imgPreviewArea');
      area.classList.add('has-image');
      area.innerHTML = `<img src="${e.target.result}" id="imgPreview">`;
    };
    reader.readAsDataURL(input.files[0]);
  }
}

async function saveProduct(id) {
  const name = document.getElementById('prodName').value.trim();
  const price = document.getElementById('prodPrice').value;
  const starsPrice = document.getElementById('prodStarsPrice').value;
  if (!name || !price) return showToast('Заполните название и цену', 'error');

  const formData = new FormData();
  formData.append('name', name);
  formData.append('description', document.getElementById('prodDesc').value);
  formData.append('price', price);
  formData.append('stars_price', starsPrice || 0);
  formData.append('category_id', document.getElementById('prodCategory').value);
  formData.append('stock', document.getElementById('prodStock').value);

  const fileInput = document.getElementById('prodImage');
  const urlInput = document.getElementById('prodImageUrl');
  if (fileInput.files && fileInput.files[0]) {
    formData.append('image', fileInput.files[0]);
  } else if (urlInput && urlInput.value.trim()) {
    formData.append('image_url', urlInput.value.trim());
  }

  try {
    const url = id ? `/api/products/${id}` : '/api/products';
    const method = id ? 'PUT' : 'POST';
    await apiCall(url, method, formData, true);
    closeModal();
    showToast(id ? 'Сохранено' : 'Товар создан', 'success');
    setTimeout(() => loadAdminTab(), 250);
  } catch (e) { showToast(e.message, 'error'); }
}

async function deleteProduct(id) {
  if (!confirm('Удалить товар?')) return;
  try {
    await apiCall(`/api/products/${id}`, 'DELETE');
    showToast('Удалено', 'success');
    await loadAdminTab();
  } catch (e) { showToast(e.message, 'error'); }
}

async function renderAdminPromos(container) {
  const promos = await apiCall('/api/promos');

  container.innerHTML = `
    <div class="admin-fade-in">
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">
        ${promos.map((p, i) => `
          <div class="promo-card ${!p.active ? 'inactive' : ''}" style="animation: itemSlideIn 0.3s ease ${i * 0.04}s both">
            <div style="flex:1;min-width:0">
              <div class="promo-code-display">${p.code}</div>
              <div class="promo-discount" style="margin-top:6px">
                ${p.discount_percent > 0 ? `${p.discount_percent}%` : `${formatPrice(p.discount_amount)} ₽`}
              </div>
              <div class="promo-uses">Использован: ${p.used_count}${p.max_uses > 0 ? ` / ${p.max_uses}` : ''}</div>
            </div>
            <div class="item-actions">
              <button class="icon-btn ${p.active ? 'danger' : ''}" title="${p.active ? 'Деактивировать' : 'Активировать'}" onclick="togglePromo(${p.id},${p.active ? 0 : 1})">
                ${p.active ? ICONS.pause : ICONS.play}
              </button>
              <button class="icon-btn danger" onclick="deletePromo(${p.id})">${ICONS.trash}</button>
            </div>
          </div>
        `).join('')}
      </div>
      <button class="admin-add-btn" onclick="addPromo()">
        ${ICONS.plus} Новый промокод
      </button>
    </div>
  `;
}

function addPromo() {
  openModal('Новый промокод', `
    <div class="form-group">
      <label class="form-label">Код</label>
      <input class="form-input" id="promoCode" placeholder="SALE20" style="text-transform:uppercase">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Скидка %</label>
        <input class="form-input" type="number" id="promoPercent" placeholder="0">
      </div>
      <div class="form-group">
        <label class="form-label">Скидка ₽</label>
        <input class="form-input" type="number" id="promoAmount" placeholder="0">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Макс. использований (0 = ∞)</label>
      <input class="form-input" type="number" id="promoMaxUses" placeholder="0">
    </div>
    <button class="btn-primary" onclick="saveNewPromo()">Создать</button>
  `);
}

async function saveNewPromo() {
  const code = document.getElementById('promoCode').value.trim();
  if (!code) return showToast('Введите код', 'error');
  try {
    await apiCall('/api/promos', 'POST', {
      code,
      discount_percent: parseInt(document.getElementById('promoPercent').value) || 0,
      discount_amount: parseInt(document.getElementById('promoAmount').value) || 0,
      max_uses: parseInt(document.getElementById('promoMaxUses').value) || 0
    });
    closeModal();
    showToast('Промокод создан', 'success');
    setTimeout(() => loadAdminTab(), 250);
  } catch (e) { showToast(e.message, 'error'); }
}

async function togglePromo(id, active) {
  try {
    await apiCall(`/api/promos/${id}`, 'PUT', { active });
    showToast(active ? 'Активирован' : 'Деактивирован', 'success');
    await loadAdminTab();
  } catch (e) { showToast(e.message, 'error'); }
}

async function deletePromo(id) {
  if (!confirm('Удалить промокод?')) return;
  try {
    await apiCall(`/api/promos/${id}`, 'DELETE');
    showToast('Удалено', 'success');
    await loadAdminTab();
  } catch (e) { showToast(e.message, 'error'); }
}

async function renderAdminUsers(container) {
  const users = await apiCall('/api/users');
  const SUPER_ID = 7175369171;

  container.innerHTML = `
    <div class="admin-fade-in">
      <div class="admin-add-admin-section">
        <div class="section-title" style="margin-bottom:10px">${ICONS.userPlus} Назначить админа</div>
        <div class="promo-input-group">
          <input class="form-input" id="adminGrantInput" placeholder="TG ID или @username" style="border-radius:8px">
          <button class="promo-apply-btn" onclick="grantAdmin()">
            ${ICONS.shield} Назначить
          </button>
        </div>
      </div>

      <div class="section-title" style="margin-top:20px">${ICONS.users} Все пользователи</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${users.map((u, i) => {
    const isSuperAdmin = u.tg_id == SUPER_ID;
    const displayName = u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : `ID: ${u.tg_id}`;
    return `
            <div class="admin-list-item" style="animation: itemSlideIn 0.3s ease ${i * 0.03}s both">
              <div class="item-content">
                <div class="item-title" style="display:flex;align-items:center;gap:6px">
                  ${escapeHtml(displayName)}
                  ${isSuperAdmin ? `<span class="admin-badge super">${ICONS.crown} Главный</span>` : ''}
                  ${u.is_admin && !isSuperAdmin ? `<span class="admin-badge">${ICONS.shield} Админ</span>` : ''}
                </div>
                <div class="item-sub">
                  ${u.username ? `@${u.username} • ` : ''}TG: ${u.tg_id} • ${formatDate(u.created_at)}
                </div>
              </div>
              <div class="item-actions">
                ${u.is_admin && !isSuperAdmin ? `
                  <button class="icon-btn danger" title="Снять админа" onclick="revokeAdmin(${u.id},${u.tg_id})">
                    ${ICONS.userMinus}
                  </button>
                ` : ''}
                ${!u.is_admin ? `
                  <button class="icon-btn" title="Назначить админом" onclick="grantAdminById(${u.id},${u.tg_id})">
                    ${ICONS.userPlus}
                  </button>
                ` : ''}
              </div>
            </div>
          `;
  }).join('')}
      </div>
    </div>
  `;
}

async function grantAdmin() {
  const input = document.getElementById('adminGrantInput').value.trim();
  if (!input) return showToast('Введите TG ID или @username', 'error');

  const body = {};
  if (/^\d+$/.test(input)) {
    body.tg_id = parseInt(input);
  } else {
    body.username = input.replace('@', '');
  }

  try {
    await apiCall('/api/users/admin/grant', 'POST', body);
    showToast('Админ назначен!', 'success');
    await loadAdminTab();
  } catch (e) { showToast(e.message, 'error'); }
}

async function grantAdminById(userId, tgId) {
  try {
    await apiCall('/api/users/admin/grant', 'POST', { tg_id: tgId });
    showToast('Админ назначен!', 'success');
    await loadAdminTab();
  } catch (e) { showToast(e.message, 'error'); }
}

async function revokeAdmin(userId, tgId) {
  if (!confirm('Снять права администратора?')) return;
  try {
    await apiCall('/api/users/admin/revoke', 'POST', { user_id: userId, tg_id: tgId });
    showToast('Права сняты', 'success');
    await loadAdminTab();
  } catch (e) { showToast(e.message, 'error'); }
}

let bcCursorPos = 0;

async function renderAdminBroadcast(container) {
  container.innerHTML = `
    <div class="admin-fade-in">
      <div class="section-title" style="margin-bottom:12px">${ICONS.send} Рассылка</div>

      <div class="form-group">
        <label class="form-label">Изображение (необяз.)</label>
        <div class="image-upload-tabs">
          <button type="button" class="image-upload-tab active" onclick="switchBcImgTab('file',this)">С устройства</button>
          <button type="button" class="image-upload-tab" onclick="switchBcImgTab('url',this)">По ссылке</button>
        </div>
        <div id="bcImgFile">
          <div class="image-upload-area" onclick="document.getElementById('bcImageInput').click()" id="bcImgPreviewArea">
            <div class="image-upload-icon">${ICONS.image}</div>
            <div class="image-upload-text">Нажмите для загрузки</div>
            <div class="image-upload-sub">JPG, PNG до 10 МБ</div>
          </div>
          <input type="file" id="bcImageInput" accept="image/*" style="display:none" onchange="bcPreviewFile(this)">
          <button type="button" class="bc-remove-photo-btn" id="bcRemoveFileBtn" style="display:none" onclick="bcRemovePhoto('file')">
            ${ICONS.close} Удалить фото
          </button>
        </div>
        <div id="bcImgUrl" style="display:none">
          <input class="form-input" id="bcPhotoUrl" placeholder="https://example.com/image.jpg" oninput="updateBroadcastPreview()">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Текст сообщения</label>
        <div class="broadcast-toolbar" id="bcToolbar"></div>
        <textarea class="form-textarea bc-textarea" id="bcText" rows="6"
          placeholder="Введите текст рассылки..."
          oninput="updateBroadcastPreview()"
          onfocus="bcSaveCursor()"
          onclick="bcSaveCursor()"
          onkeyup="bcSaveCursor()"></textarea>
        <div class="bc-format-hint">Форматирование: &lt;b&gt;жирный&lt;/b&gt; &lt;i&gt;курсив&lt;/i&gt; &lt;u&gt;подчёрк&lt;/u&gt; &lt;s&gt;зачёрк&lt;/s&gt; &lt;code&gt;код&lt;/code&gt;</div>
      </div>

      <div id="bcEmojiPicker" class="bc-emoji-picker" style="display:none"></div>

      <div class="form-group">
        <label class="form-label">Предпросмотр</label>
        <div class="bc-preview-wrapper" id="bcPreview">
          <div class="bc-preview-empty">Введите текст для предпросмотра</div>
        </div>
      </div>

      <button type="button" class="btn-primary" id="bcSendBtn" onclick="sendBroadcast()">${ICONS.send} Отправить рассылку</button>
      <div id="bcResult" style="margin-top:12px"></div>
    </div>
  `;

  buildBcToolbar();
}

function buildBcToolbar() {
  const toolbar = document.getElementById('bcToolbar');
  if (!toolbar) return;

  const buttons = [
    { icon: 'B', title: 'Жирный', action: () => bcWrap('b'), bold: true },
    { icon: 'I', title: 'Курсив', action: () => bcWrap('i'), italic: true },
    { icon: 'U', title: 'Подчёркнутый', action: () => bcWrap('u'), underline: true },
    { icon: 'S', title: 'Зачёркнутый', action: () => bcWrap('s'), strike: true },
    { icon: '&lt;/&gt;', title: 'Код', action: () => bcWrap('code') },
    { icon: '🔗', title: 'Ссылка', action: () => bcInsertLink() },
    { sep: true },
    { icon: '😀', title: 'Эмодзи', action: () => bcShowEmoji() },
  ];

  buttons.forEach(btn => {
    if (btn.sep) {
      const sep = document.createElement('span');
      sep.className = 'bc-tool-sep';
      toolbar.appendChild(sep);
      return;
    }
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'bc-tool-btn';
    el.title = btn.title;
    el.innerHTML = `<span style="font-size:13px;${btn.bold ? 'font-weight:800;' : ''}${btn.italic ? 'font-style:italic;' : ''}${btn.underline ? 'text-decoration:underline;' : ''}${btn.strike ? 'text-decoration:line-through;' : ''}">${btn.icon}</span>`;
    el.addEventListener('mousedown', e => e.preventDefault());
    el.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
    el.addEventListener('click', e => { e.preventDefault(); btn.action(); });
    toolbar.appendChild(el);
  });
}

function bcSaveCursor() {
  const ta = document.getElementById('bcText');
  if (ta) bcCursorPos = ta.selectionStart || 0;
}

function switchBcImgTab(tab, btn) {
  document.getElementById('bcImgFile').style.display = tab === 'file' ? '' : 'none';
  document.getElementById('bcImgUrl').style.display = tab === 'url' ? '' : 'none';
  btn.parentElement.querySelectorAll('.image-upload-tab').forEach(el => el.classList.remove('active'));
  btn.classList.add('active');
  updateBroadcastPreview();
}

function bcPreviewFile(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const area = document.getElementById('bcImgPreviewArea');
      area.classList.add('has-image');
      area.innerHTML = `<img src="${e.target.result}" id="bcImgPreview">`;
      document.getElementById('bcRemoveFileBtn').style.display = '';
      updateBroadcastPreview();
    };
    reader.readAsDataURL(input.files[0]);
  }
}

function bcRemovePhoto(type) {
  if (type === 'file') {
    const input = document.getElementById('bcImageInput');
    input.value = '';
    const area = document.getElementById('bcImgPreviewArea');
    area.classList.remove('has-image');
    area.innerHTML = `
      <div class="image-upload-icon">${ICONS.image}</div>
      <div class="image-upload-text">Нажмите для загрузки</div>
      <div class="image-upload-sub">JPG, PNG до 10 МБ</div>
    `;
    document.getElementById('bcRemoveFileBtn').style.display = 'none';
  }
  updateBroadcastPreview();
}

function bcWrap(tag) {
  const ta = document.getElementById('bcText');
  if (!ta) return;
  ta.focus();
  const start = ta.selectionStart ?? bcCursorPos;
  const end = ta.selectionEnd ?? bcCursorPos;
  const selected = ta.value.substring(start, end);
  const before = ta.value.substring(0, start);
  const after = ta.value.substring(end);
  const insertText = selected || 'текст';
  ta.value = before + `<${tag}>` + insertText + `</${tag}>` + after;
  const newPos = start + tag.length + 2 + insertText.length + tag.length + 3;
  ta.setSelectionRange(newPos, newPos);
  ta.focus();
  bcCursorPos = newPos;
  updateBroadcastPreview();
}

function bcInsertLink() {
  const ta = document.getElementById('bcText');
  if (!ta) return;
  const start = ta.selectionStart ?? bcCursorPos;
  const end = ta.selectionEnd ?? bcCursorPos;
  const selected = ta.value.substring(start, end);
  const url = prompt('Ссылка:', 'https://');
  if (!url) {
    ta.focus();
    return;
  }
  const text = selected || prompt('Текст ссылки:', 'нажми сюда') || 'ссылка';
  const before = ta.value.substring(0, start);
  const after = ta.value.substring(end);
  const link = `<a href="${url}">${text}</a>`;
  ta.value = before + link + after;
  const newPos = start + link.length;
  ta.setSelectionRange(newPos, newPos);
  ta.focus();
  bcCursorPos = newPos;
  updateBroadcastPreview();
}

const EMOJI_SET = ['😀', '😎', '🔥', '❤️', '💰', '🎉', '✅', '⚡', '🛒', '💎', '🎁', '⭐', '🚀', '👋', '💪', '🤝', '😍', '🥳', '✨', '📦', '🏷', '❌', '⏰', '📢', '🔔', '💬', '👑', '🆕', '🤑', '💸'];
let emojiVisible = false;

function bcShowEmoji() {
  const picker = document.getElementById('bcEmojiPicker');
  emojiVisible = !emojiVisible;
  if (emojiVisible) {
    picker.style.display = 'flex';
    picker.innerHTML = '';
    EMOJI_SET.forEach(e => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bc-emoji-btn';
      btn.textContent = e;
      btn.addEventListener('mousedown', ev => ev.preventDefault());
      btn.addEventListener('touchstart', ev => ev.preventDefault(), { passive: false });
      btn.addEventListener('click', ev => { ev.preventDefault(); bcInsertEmoji(e); });
      picker.appendChild(btn);
    });
  } else {
    picker.style.display = 'none';
  }
}

function bcInsertEmoji(emoji) {
  const ta = document.getElementById('bcText');
  if (!ta) return;
  ta.focus();
  const pos = ta.selectionStart ?? bcCursorPos;
  ta.value = ta.value.substring(0, pos) + emoji + ta.value.substring(pos);
  const newPos = pos + emoji.length;
  ta.setSelectionRange(newPos, newPos);
  ta.focus();
  bcCursorPos = newPos;
  updateBroadcastPreview();
}

function updateBroadcastPreview() {
  const textEl = document.getElementById('bcText');
  const text = textEl ? textEl.value : '';
  const fileInput = document.getElementById('bcImageInput');
  const urlInput = document.getElementById('bcPhotoUrl');
  const hasFile = fileInput && fileInput.files && fileInput.files[0];
  const photoUrl = urlInput ? urlInput.value.trim() : '';
  const preview = document.getElementById('bcPreview');
  if (!text && !hasFile && !photoUrl) {
    preview.innerHTML = '<div class="bc-preview-empty">Введите текст для предпросмотра</div>';
    return;
  }

  let photoHtml = '';
  if (hasFile) {
    const imgPreview = document.getElementById('bcImgPreview');
    if (imgPreview) photoHtml = `<div class="bc-msg-photo"><img src="${imgPreview.src}"></div>`;
  } else if (photoUrl) {
    photoHtml = `<div class="bc-msg-photo"><img src="${escapeHtml(photoUrl)}" onerror="this.parentElement.style.display='none'"></div>`;
  }

  preview.innerHTML = `
    <div class="bc-msg-bubble">
      ${photoHtml}
      ${text ? `<div class="bc-msg-text">${text}</div>` : ''}
    </div>
  `;
}

async function sendBroadcast() {
  const text = document.getElementById('bcText').value.trim();
  const fileInput = document.getElementById('bcImageInput');
  const urlInput = document.getElementById('bcPhotoUrl');
  const hasFile = fileInput && fileInput.files && fileInput.files[0];
  const photoUrl = urlInput ? urlInput.value.trim() : '';

  if (!text && !hasFile && !photoUrl) return showToast('Введите текст или фото', 'error');
  if (!confirm('Отправить рассылку всем пользователям?')) return;

  const btn = document.getElementById('bcSendBtn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px"></div> Отправка...';

  try {
    const formData = new FormData();
    formData.append('text', text);
    formData.append('parse_mode', 'HTML');
    if (hasFile) {
      formData.append('photo', fileInput.files[0]);
    } else if (photoUrl) {
      formData.append('photo_url', photoUrl);
    }

    const result = await apiCall('/api/broadcast', 'POST', formData, true);
    document.getElementById('bcResult').innerHTML = `
      <div class="stat-card" style="text-align:center">
        <div class="stat-value" style="color:var(--accent)">${result.sent}</div>
        <div class="stat-label">Доставлено</div>
        ${result.failed > 0 ? `<div class="stat-sub" style="color:#f44">Не доставлено: ${result.failed}</div>` : ''}
      </div>
    `;
    showToast(`Рассылка отправлена: ${result.sent} из ${result.total}`, 'success');
  } catch (e) {
    showToast(e.message || 'Ошибка рассылки', 'error');
  }

  btn.disabled = false;
  btn.innerHTML = `${ICONS.send} Отправить рассылку`;
}



async function renderAdminCases(container) {
  const cases = await apiCall('/api/cases/all');

  container.innerHTML = `
    <div class="admin-fade-in">
      <div class="admin-list" id="casesList">
        ${cases.map((c, i) => `
          <div class="admin-list-item" draggable="true" data-id="${c.id}" data-sort="${c.sort_order}"
               ondragstart="onDragStart(event)" ondragover="onDragOver(event)" ondrop="onDropCase(event)" ondragend="onDragEnd(event)"
               style="animation: itemSlideIn 0.3s ease ${i * 0.04}s both">
            <div class="drag-handle">${ICONS.drag}</div>
            ${c.image_url ? `
              <div class="admin-case-thumb">
                <img src="${c.image_url}" alt="">
              </div>
            ` : ''}
            <div class="item-content">
              <div class="item-title">${escapeHtml(c.name)}</div>
              <div class="item-sub"><img src="/assets/icons/tg_star_icon.png" alt="⭐" class="stars-icon-inline"> ${c.price} • ${c.items_count} предметов • ${c.active ? 'Активен' : 'Неактивен'}</div>
            </div>
            <div class="item-actions">
              <button class="icon-btn" onclick="editCase(${c.id})">${ICONS.edit}</button>
              <button class="icon-btn ${c.active ? 'danger' : ''}" onclick="toggleCase(${c.id}, ${c.active ? 0 : 1})" title="${c.active ? 'Деактивировать' : 'Активировать'}">
                ${c.active ? ICONS.pause : ICONS.play}
              </button>
              <button class="icon-btn danger" onclick="deleteCase(${c.id})">${ICONS.trash}</button>
            </div>
          </div>
        `).join('')}
      </div>
      <button class="admin-add-btn" onclick="addCase()">
        ${ICONS.plus} Добавить кейс
      </button>
    </div>
  `;
}

function onDropCase(e) {
  e.preventDefault();
  const target = e.currentTarget;
  target.classList.remove('drag-over');
  if (!draggedEl || target === draggedEl) return;
  const list = document.getElementById('casesList');
  const items = [...list.children];
  const fromIndex = items.indexOf(draggedEl);
  const toIndex = items.indexOf(target);
  if (fromIndex < toIndex) { target.after(draggedEl); } else { target.before(draggedEl); }
  saveCaseOrder();
}

async function saveCaseOrder() {
  const items = [...document.querySelectorAll('#casesList .admin-list-item')];
  const order = items.map((el, i) => ({ id: parseInt(el.dataset.id), sort_order: i + 1 }));
  try {
    await apiCall('/api/cases/reorder/all', 'PUT', { order });
  } catch (e) { showToast('Ошибка сортировки', 'error'); }
}

function addCase() {
  showCaseForm();
}

async function editCase(id) {
  try {
    const caseData = await apiCall(`/api/cases/${id}`);
    showCaseForm(caseData);
  } catch (e) { showToast('Ошибка загрузки', 'error'); }
}

async function showCaseForm(caseData = null) {
  const products = await apiCall('/api/products');
  const isEdit = !!caseData;

  openModal(isEdit ? 'Редактировать кейс' : 'Новый кейс', `
    <div class="form-group">
      <label class="form-label">Название</label>
      <input class="form-input" id="caseName" value="${caseData ? escapeHtml(caseData.name) : ''}">
    </div>
    <div class="form-group">
      <label class="form-label">Описание</label>
      <textarea class="form-textarea" id="caseDesc">${caseData ? escapeHtml(caseData.description || '') : ''}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Цена (звёзды)</label>
      <input class="form-input" type="number" id="casePrice" value="${caseData ? caseData.price : ''}" min="1">
    </div>
    <div class="form-group">
      <label class="form-label">Изображение</label>
      <div class="image-upload-tabs">
        <button type="button" class="image-upload-tab active" onclick="switchImgTab('file',this)">С устройства</button>
        <button type="button" class="image-upload-tab" onclick="switchImgTab('url',this)">По ссылке</button>
      </div>
      <div id="imgUploadFile">
        <div class="image-upload-area ${caseData && caseData.image_url ? 'has-image' : ''}" onclick="document.getElementById('caseImage').click()" id="imgPreviewArea">
          ${caseData && caseData.image_url
      ? `<img src="${caseData.image_url}" id="imgPreview">`
      : `<div class="image-upload-icon">${ICONS.image}</div><div class="image-upload-text">Нажмите для загрузки</div><div class="image-upload-sub">JPG, PNG до 10 МБ</div>`
    }
        </div>
        <input type="file" id="caseImage" accept="image/*" style="display:none" onchange="previewImg(this)">
      </div>
      <div id="imgUploadUrl" style="display:none">
        <input class="form-input" id="caseImageUrl" placeholder="https://..." value="${caseData && caseData.image_url && caseData.image_url.startsWith('http') ? caseData.image_url : ''}">
      </div>
    </div>

    ${isEdit ? `
      <div class="form-group">
        <label class="form-label">Предметы в кейсе</label>
        <div id="caseItemsList" style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">
          ${(caseData.items || []).map(item => `
            <div class="case-admin-item">
              ${item.image_url ? `
                <div class="case-admin-item-thumb">
                  <img src="${item.image_url}" alt="">
                </div>
              ` : ''}
              <div style="flex:1">
                <div style="font-size:13px;font-weight:600">${escapeHtml(item.name)}</div>
                <div style="font-size:11px;color:var(--text-secondary);margin-top:2px">Шанс: ${item.chance}%</div>
              </div>
              <button type="button" class="icon-btn" onclick="editCaseItem(${item.id}, ${item.chance})">
                ${ICONS.edit}
              </button>
              <button type="button" class="icon-btn danger" onclick="deleteCaseItem(${caseData.id}, ${item.id})">
                ${ICONS.trash}
              </button>
            </div>
          `).join('')}
        </div>
        <button type="button" class="admin-add-btn" onclick="addCaseItem(${caseData.id})">
          ${ICONS.plus} Добавить предмет
        </button>
      </div>
    ` : ''}

    <button class="btn-primary" onclick="saveCase(${isEdit ? caseData.id : 'null'})">${isEdit ? 'Сохранить' : 'Создать'}</button>
  `);
}

async function saveCase(id) {
  const name = document.getElementById('caseName').value.trim();
  const price = document.getElementById('casePrice').value;
  if (!name || !price) return showToast('Заполните название и цену', 'error');

  const formData = new FormData();
  formData.append('name', name);
  formData.append('description', document.getElementById('caseDesc').value);
  formData.append('price', price);

  const fileInput = document.getElementById('caseImage');
  const urlInput = document.getElementById('caseImageUrl');
  if (fileInput.files && fileInput.files[0]) {
    formData.append('image', fileInput.files[0]);
  } else if (urlInput && urlInput.value.trim()) {
    formData.append('image_url', urlInput.value.trim());
  }

  try {
    const url = id ? `/api/cases/${id}` : '/api/cases';
    const method = id ? 'PUT' : 'POST';
    await apiCall(url, method, formData, true);
    closeModal();
    showToast(id ? 'Сохранено' : 'Кейс создан', 'success');
    setTimeout(() => loadAdminTab(), 250);
  } catch (e) { showToast(e.message, 'error'); }
}

async function toggleCase(id, active) {
  try {
    await apiCall(`/api/cases/${id}`, 'PUT', { active });
    showToast(active ? 'Активирован' : 'Деактивирован', 'success');
    await loadAdminTab();
  } catch (e) { showToast(e.message, 'error'); }
}

async function deleteCase(id) {
  if (!confirm('Удалить кейс?')) return;
  try {
    await apiCall(`/api/cases/${id}`, 'DELETE');
    showToast('Удалено', 'success');
    await loadAdminTab();
  } catch (e) { showToast(e.message, 'error'); }
}

async function addCaseItem(caseId) {
  const products = await apiCall('/api/products');
  
  openModal('Добавить предмет', `
    <div class="form-group">
      <label class="form-label">Товар</label>
      <select class="form-select" id="itemProduct" onchange="updateProductPreview()">
        ${products.map(p => `<option value="${p.id}" data-image="${p.image_url || ''}" data-name="${escapeHtml(p.name)}" data-stars="${p.stars_price || 0}">${escapeHtml(p.name)}</option>`).join('')}
      </select>
      <div id="productPreview" style="margin-top:12px;display:none">
        <div style="display:flex;align-items:center;gap:12px;padding:10px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px">
          <div id="previewImage" style="width:48px;height:48px;border-radius:6px;overflow:hidden;background:var(--bg-secondary)"></div>
          <div style="flex:1">
            <div id="previewName" style="font-size:13px;font-weight:600"></div>
            <div id="previewStars" style="font-size:12px;color:var(--text-secondary);margin-top:2px"></div>
          </div>
        </div>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Шанс выпадения (%)</label>
      <input class="form-input" type="number" id="itemChance" placeholder="10" min="0.01" step="0.01">
    </div>
    <button class="btn-primary" onclick="saveCaseItem(${caseId})">Добавить</button>
  `);
  
  window.__productsData = products;
  updateProductPreview();
}

function updateProductPreview() {
  const select = document.getElementById('itemProduct');
  const preview = document.getElementById('productPreview');
  const previewImage = document.getElementById('previewImage');
  const previewName = document.getElementById('previewName');
  const previewStars = document.getElementById('previewStars');
  
  if (!select || !preview || !window.__productsData) return;
  
  const selectedOption = select.options[select.selectedIndex];
  const productId = selectedOption.value;
  const product = window.__productsData.find(p => p.id == productId);
  
  if (product) {
    preview.style.display = '';
    previewName.textContent = product.name;
    
    if (previewStars) {
      const starsPrice = product.stars_price || 0;
      previewStars.innerHTML = starsPrice > 0 ? `<img src="/assets/icons/tg_star_icon.png" alt="⭐" class="stars-icon-inline"> ${starsPrice} звёзд` : 'Цена в звездах не указана';
    }
    
    if (product.image_url) {
      previewImage.innerHTML = `<img src="${product.image_url}" style="width:100%;height:100%;object-fit:cover">`;
    } else {
      previewImage.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-tertiary)">${ICONS.box}</div>`;
    }
  }
}

async function saveCaseItem(caseId) {
  const product_id = document.getElementById('itemProduct').value;
  const chance = document.getElementById('itemChance').value;
  if (!product_id || !chance) return showToast('Заполните все поля', 'error');

  try {
    await apiCall(`/api/cases/${caseId}/items`, 'POST', { product_id, chance });
    closeModal();
    showToast('Предмет добавлен', 'success');
    setTimeout(() => editCase(caseId), 250);
  } catch (e) { showToast(e.message, 'error'); }
}

function editCaseItem(itemId, currentChance) {
  openModal('Изменить шанс', `
    <div class="form-group">
      <label class="form-label">Шанс выпадения (%)</label>
      <input class="form-input" type="number" id="editItemChance" value="${currentChance}" min="0.01" step="0.01">
    </div>
    <button class="btn-primary" onclick="saveEditCaseItem(${itemId})">Сохранить</button>
  `);
}

async function saveEditCaseItem(itemId) {
  const chance = document.getElementById('editItemChance').value;
  if (!chance) return showToast('Введите шанс', 'error');

  try {
    const caseId = new URLSearchParams(window.location.search).get('caseId');
    await apiCall(`/api/cases/0/items/${itemId}`, 'PUT', { chance });
    closeModal();
    showToast('Сохранено', 'success');
  } catch (e) { showToast(e.message, 'error'); }
}

async function deleteCaseItem(caseId, itemId) {
  if (!confirm('Удалить предмет из кейса?')) return;
  try {
    await apiCall(`/api/cases/${caseId}/items/${itemId}`, 'DELETE');
    showToast('Удалено', 'success');
    setTimeout(() => editCase(caseId), 250);
  } catch (e) { showToast(e.message, 'error'); }
}

let allUsersForSettings = [];
let currentSellerTgId = null;

async function renderAdminSettings(container) {
  try {
    const [settings, users] = await Promise.all([
      apiCall('/api/settings'),
      apiCall('/api/users')
    ]);
    
    allUsersForSettings = users;
    currentSellerTgId = settings.seller_tg_id || null;
    
    const currentSeller = users.find(u => String(u.tg_id) === String(currentSellerTgId));
    
    container.innerHTML = `
      <div class="admin-fade-in">
        <div class="section-title" style="margin-bottom:16px">${ICONS.admin} Настройки магазина</div>
        
        <div class="settings-seller-section">
          <div class="section-title" style="margin-bottom:10px;font-size:13px">${ICONS.profile} Продавец для оформления заказов</div>
          <div class="form-help" style="margin-bottom:12px">
            Выберите пользователя, к которому будут перенаправляться покупатели для оформления заказов и получения призов
          </div>
          
          ${currentSeller ? `
            <div class="current-seller-card">
              <div class="item-content">
                <div class="item-title" style="display:flex;align-items:center;gap:6px">
                  ${ICONS.check} Текущий продавец: ${escapeHtml(currentSeller.first_name || 'ID: ' + currentSeller.tg_id)}
                </div>
                <div class="item-sub">
                  ${currentSeller.username ? `@${currentSeller.username} • ` : ''}TG ID: ${currentSeller.tg_id}
                </div>
              </div>
              <button class="icon-btn danger" onclick="clearSeller()" title="Сбросить">
                ${ICONS.close}
              </button>
            </div>
          ` : `
            <div class="form-help" style="padding:12px;background:var(--bg-elevated);border-radius:8px;margin-bottom:12px">
              ⚠️ Продавец не назначен. Используется главный админ по умолчанию.
            </div>
          `}
          
          <div class="promo-input-group" style="margin-top:12px">
            <input class="form-input" id="sellerSearchInput" placeholder="Поиск по имени или @username" 
                   oninput="filterSellersSearch()" style="border-radius:8px">
          </div>
        </div>

        <div class="section-title" style="margin-top:20px;margin-bottom:10px">${ICONS.users} Выбрать продавца</div>
        <div id="sellersUsersList" style="display:flex;flex-direction:column;gap:6px">
          ${renderSellersList(users)}
        </div>
      </div>
    `;
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-text">Ошибка загрузки настроек</div></div>`;
  }
}

function renderSellersList(users) {
  if (!users || users.length === 0) {
    return '<div class="empty-state"><div class="empty-state-text">Нет пользователей</div></div>';
  }
  
  return users.map((u, i) => {
    const displayName = u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : `ID: ${u.tg_id}`;
    const isCurrentSeller = String(u.tg_id) === String(currentSellerTgId);
    
    return `
      <div class="admin-list-item ${isCurrentSeller ? 'seller-selected' : ''}" style="animation: itemSlideIn 0.3s ease ${i * 0.03}s both">
        <div class="item-content">
          <div class="item-title" style="display:flex;align-items:center;gap:6px">
            ${escapeHtml(displayName)}
            ${isCurrentSeller ? `<span class="admin-badge" style="background:var(--success)">${ICONS.check} Продавец</span>` : ''}
            ${u.is_admin ? `<span class="admin-badge">${ICONS.shield} Админ</span>` : ''}
          </div>
          <div class="item-sub">
            ${u.username ? `@${u.username} • ` : ''}TG ID: ${u.tg_id} • ${formatDate(u.created_at)}
          </div>
        </div>
        <div class="item-actions">
          ${!isCurrentSeller ? `
            <button class="icon-btn" title="Назначить продавцом" onclick="setAsSeller(${u.tg_id}, '${escapeHtml(displayName)}')">
              ${ICONS.check}
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function filterSellersSearch() {
  const searchInput = document.getElementById('sellerSearchInput');
  const query = searchInput.value.toLowerCase().trim();
  
  let filtered = allUsersForSettings;
  
  if (query) {
    filtered = allUsersForSettings.filter(u => {
      const name = (u.first_name || '').toLowerCase() + ' ' + (u.last_name || '').toLowerCase();
      const username = (u.username || '').toLowerCase();
      const tgId = String(u.tg_id);
      
      return name.includes(query) || username.includes(query) || tgId.includes(query);
    });
  }
  
  const listContainer = document.getElementById('sellersUsersList');
  listContainer.innerHTML = renderSellersList(filtered);
}

async function setAsSeller(tgId, displayName) {
  if (!confirm(`Назначить "${displayName}" продавцом?`)) return;
  
  try {
    await apiCall('/api/settings', 'PUT', { seller_tg_id: String(tgId) });
    showToast('Продавец назначен!', 'success');
    await loadAdminTab();
  } catch (e) {
    showToast(e.message || 'Ошибка назначения', 'error');
  }
}

async function clearSeller() {
  if (!confirm('Сбросить продавца? Будет использоваться главный админ по умолчанию.')) return;
  
  try {
    const SUPER_ID = 7175369171;
    await apiCall('/api/settings', 'PUT', { seller_tg_id: String(SUPER_ID) });
    showToast('Продавец сброшен', 'success');
    await loadAdminTab();
  } catch (e) {
    showToast(e.message || 'Ошибка', 'error');
  }
}
