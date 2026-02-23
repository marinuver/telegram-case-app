let appliedPromo = null;
let promoDiscount = 0;

async function renderCart() {
  const main = document.getElementById('mainContent');

  if (!cart.length) {
    main.innerHTML = `
      <div class="page">
        <div class="cart-empty">
          <div class="cart-empty-icon">${ICONS.cart}</div>
          <div class="cart-empty-text">Корзина пуста</div>
          <div class="cart-empty-sub">Добавьте товары из каталога</div>
          <button class="btn-primary" style="max-width:200px;margin:20px auto 0" onclick="navigate('shop')">
            ${ICONS.catalog} В каталог
          </button>
        </div>
      </div>
    `;
    return;
  }

  const subtotal = getCartTotal();
  const discount = promoDiscount;
  const total = Math.max(0, subtotal - discount);

  main.innerHTML = `
    <div class="page">
      <div class="cart-list">
        ${cart.map((item, i) => `
          <div class="cart-item" style="animation: itemSlideIn 0.3s ease ${i * 0.05}s both">
            <div class="cart-item-image">
              ${item.image_url
      ? `<img src="${item.image_url}" alt="">`
      : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#333">${ICONS.box}</div>`
    }
            </div>
            <div class="cart-item-info">
              <div class="cart-item-name">${escapeHtml(item.name)}</div>
              <div class="cart-item-price">${formatPrice(item.price)} ₽</div>
            </div>
            <div class="cart-item-controls">
              <button class="qty-btn" onclick="updateCartQty(${item.id},-1)">−</button>
              <span class="qty-value">${item.quantity}</span>
              <button class="qty-btn" onclick="updateCartQty(${item.id},1)">+</button>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="cart-summary">
        <div class="cart-summary-row">
          <span>Товары (${cart.reduce((s, i) => s + i.quantity, 0)})</span>
          <span>${formatPrice(subtotal)} ₽</span>
        </div>
        ${discount > 0 ? `
          <div class="cart-summary-row">
            <span>Скидка (${appliedPromo})</span>
            <span class="cart-discount">−${formatPrice(discount)} ₽</span>
          </div>
        ` : ''}
        <div class="cart-summary-row total">
          <span>Итого</span>
          <span>${formatPrice(total)} ₽</span>
        </div>

        <div class="promo-input-group">
          <input type="text" id="promoInput" placeholder="Промокод" value="${appliedPromo || ''}">
          <button class="promo-apply-btn" onclick="applyPromo()">
            ${ICONS.tag} Применить
          </button>
        </div>
      </div>

      <button class="btn-primary" id="checkoutBtn" onclick="checkout()">
        ${ICONS.send} Оформить заказ
      </button>
    </div>
  `;
}

async function applyPromo() {
  const code = document.getElementById('promoInput').value.trim();
  if (!code) return showToast('Введите промокод', 'error');

  try {
    const result = await apiCall('/api/promos/validate', 'POST', { code });
    if (result.valid) {
      appliedPromo = code.toUpperCase();
      const subtotal = getCartTotal();
      if (result.discount_percent > 0) {
        promoDiscount = subtotal * (result.discount_percent / 100);
      } else if (result.discount_amount > 0) {
        promoDiscount = result.discount_amount;
      }
      showToast(`Промокод ${appliedPromo} применён!`, 'success');
      renderCart();
    } else {
      showToast(result.error || 'Неверный промокод', 'error');
    }
  } catch (e) {
    showToast('Ошибка проверки промокода', 'error');
  }
}

async function checkout() {
  const btn = document.getElementById('checkoutBtn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px"></div> Оформляем...';

  try {
    const items = cart.map(item => ({
      product_id: item.id,
      quantity: item.quantity
    }));

    const result = await apiCall('/api/orders', 'POST', {
      items,
      promo_code: appliedPromo
    });

    const productList = cart.map(item =>
      `• ${item.name} × ${item.quantity} (${formatPrice(item.price * item.quantity)} ₽)`
    ).join('\n');

    const total = result.total || getCartTotal();
    const customerName = (tgUser && tgUser.first_name) || (currentUser && currentUser.first_name) || '';

    let message = `Здравствуйте! 👋\n\nМеня заинтересовали товары:\n${productList}\n\nИтого: ${formatPrice(total)} ₽`;
    if (result.promo_code) {
      message += `\nПромокод: ${result.promo_code}`;
    }
    message += `\n\nЗаказ #${result.id}`;

    cart = [];
    appliedPromo = null;
    promoDiscount = 0;
    saveCart();

    showToast('Заказ оформлен!', 'success');

    const sUsername = result.sellerUsername || sellerUsername;
    if (sUsername && window.Telegram && window.Telegram.WebApp) {
      const encodedMsg = encodeURIComponent(message);
      setTimeout(() => {
        window.Telegram.WebApp.openTelegramLink(`https://t.me/${sUsername}?text=${encodedMsg}`);
      }, 500);
    } else if (sUsername) {
      const encodedMsg = encodeURIComponent(message);
      window.open(`https://t.me/${sUsername}?text=${encodedMsg}`, '_blank');
    }

    renderCart();
  } catch (e) {
    showToast(e.message || 'Ошибка оформления', 'error');
    btn.disabled = false;
    btn.innerHTML = `${ICONS.send} Оформить заказ`;
  }
}
