let shopLoaded = false;

async function renderShop(categoryId = null, searchQuery = '') {
  const main = document.getElementById('mainContent');

  if (!shopLoaded && !allProducts.length) {
    main.innerHTML = `
      <div class="page">
        <div class="category-chips" style="margin-bottom:16px">
          ${Array(5).fill('<div class="skeleton" style="width:80px;height:36px;border-radius:100px;flex-shrink:0"></div>').join('')}
        </div>
        <div class="products-grid">
          ${Array(6).fill(`
            <div style="border-radius:20px;overflow:hidden">
              <div class="skeleton" style="width:100%;aspect-ratio:1"></div>
              <div style="padding:12px;background:var(--bg-card)">
                <div class="skeleton" style="width:80%;height:14px;margin-bottom:8px"></div>
                <div class="skeleton" style="width:50%;height:18px"></div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  try {
    if (!allCategories.length) {
      allCategories = await apiCall('/api/categories');
    }
    let url = '/api/products?';
    if (categoryId) url += `category_id=${categoryId}&`;
    if (searchQuery) url += `search=${encodeURIComponent(searchQuery)}&`;
    allProducts = await apiCall(url);
    shopLoaded = true;
  } catch (e) {
    console.error('Failed to load shop data', e);
    if (!shopLoaded) {
      main.innerHTML = `
        <div class="page">
          <div class="empty-state">
            <div class="empty-state-icon">${ICONS.diamond}</div>
            <div class="empty-state-title">Не удалось загрузить</div>
            <div class="empty-state-text">Попробуйте обновить страницу</div>
          </div>
        </div>
      `;
      return;
    }
  }

  const chips = allCategories.map(cat => `
    <button class="chip ${categoryId == cat.id ? 'active' : ''}" onclick="renderShop(${cat.id})">
      ${escapeHtml(cat.name)}
    </button>
  `).join('');

  const products = allProducts.map((product, i) => `
    <div class="product-card ${product.stock === 0 ? 'out-of-stock' : ''}" onclick="showProductDetail(${product.id})" style="animation-delay:${i * 0.04}s">
      <div class="product-image">
        ${product.image_url
      ? `<img src="${product.image_url}" alt="${escapeHtml(product.name)}" loading="lazy">`
      : `<div class="product-image-placeholder">${ICONS.diamond}</div>`
    }
        ${product.stock === 0 ? '<div class="out-of-stock-badge">Нет в наличии</div>' : (product.stock > 0 && product.stock <= 5 ? `<div class="out-of-stock-badge" style="background:rgba(255,165,0,0.8)">Осталось ${product.stock} шт.</div>` : '')}
      </div>
      <div class="product-info">
        <div class="product-name">${escapeHtml(product.name)}</div>
        ${product.description ? `<div class="product-desc">${escapeHtml(product.description)}</div>` : ''}
        <div class="product-bottom">
          <div class="product-price">${formatPrice(product.price)} <span class="currency">₽</span></div>
          ${product.stock !== 0 ? `
            <button class="add-to-cart-btn ${isInCart(product.id) ? 'added' : ''}" onclick="event.stopPropagation(); quickAddToCart(${product.id})">
              ${isInCart(product.id) ? ICONS.check : ICONS.plus}
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `).join('');

  main.innerHTML = `
    <div class="page">
      <div class="category-chips">
        <button class="chip ${!categoryId ? 'active' : ''}" onclick="renderShop()">Все</button>
        ${chips}
      </div>
      ${allProducts.length ? `
        <div class="products-grid">${products}</div>
      ` : `
        <div class="empty-state">
          <div class="empty-state-icon">${ICONS.search}</div>
          <div class="empty-state-title">Товары не найдены</div>
          <div class="empty-state-text">Попробуйте другую категорию или поисковый запрос</div>
        </div>
      `}
    </div>
  `;
}

function quickAddToCart(productId) {
  const product = allProducts.find(p => p.id === productId);
  if (product) {
    addToCart(product);
    document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
      const onclick = btn.getAttribute('onclick');
      if (onclick && onclick.includes(`quickAddToCart(${productId})`)) {
        btn.classList.add('added');
        btn.innerHTML = ICONS.check;
      }
    });
  }
}

async function showProductDetail(productId) {
  try {
    const product = await apiCall(`/api/products/${productId}`);

    const html = `
      ${product.image_url ? `
        <div class="product-detail-image">
          <img src="${product.image_url}" alt="${escapeHtml(product.name)}">
        </div>
      ` : ''}
      <div class="product-detail-name">${escapeHtml(product.name)}</div>
      ${product.category_name ? `<div class="product-detail-category">${escapeHtml(product.category_name)}</div>` : ''}
      ${product.description ? `<div class="product-detail-desc">${escapeHtml(product.description)}</div>` : ''}
      <div class="product-detail-price">${formatPrice(product.price)} ₽</div>
      ${product.stock !== 0 ? `
        <div class="detail-qty-row">
          <div class="detail-qty-controls">
            <button class="detail-qty-btn" onclick="changeDetailQty(-1)">−</button>
            <span class="detail-qty-value" id="detailQty">1</span>
            <button class="detail-qty-btn" onclick="changeDetailQty(1)">+</button>
          </div>
        </div>
        <button class="btn-primary" onclick="addProductFromDetail(${product.id})">В корзину</button>
      ` : '<button class="btn-primary" disabled>Нет в наличии</button>'}
    `;

    openModal(product.name, html);
  } catch (e) {
    showToast('Не удалось загрузить товар', 'error');
  }
}

let detailQty = 1;
function changeDetailQty(delta) {
  detailQty = Math.max(1, detailQty + delta);
  const el = document.getElementById('detailQty');
  if (el) el.textContent = detailQty;
}

function addProductFromDetail(productId) {
  const product = allProducts.find(p => p.id === productId);
  if (product) {
    for (let i = 0; i < detailQty; i++) {
      addToCart(product);
    }
    detailQty = 1;
    closeModal();
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}
