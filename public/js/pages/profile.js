async function renderProfile() {
  const main = document.getElementById('mainContent');

  const displayUser = tgUser || currentUser || {};
  const firstName = displayUser.first_name || '';
  const lastName = displayUser.last_name || '';
  const username = displayUser.username || (currentUser && currentUser.username) || '';
  const photoUrl = displayUser.photo_url || (currentUser && currentUser.photo_url) || '';
  const isAdmin = currentUser && currentUser.is_admin;

  main.innerHTML = `
    <div class="page">
      <div class="profile-card">
        <div class="profile-avatar">
          ${photoUrl
      ? `<img src="${photoUrl}" alt="Avatar">`
      : `<div class="profile-avatar-placeholder">${ICONS.profile}</div>`
    }
        </div>
        <div class="profile-name-row">
          <span class="profile-name">${escapeHtml(firstName)} ${escapeHtml(lastName)}</span>
          ${isAdmin ? `<span class="admin-badge">${ICONS.shield} Админ</span>` : ''}
        </div>
        ${username ? `<div class="profile-username">@${escapeHtml(username)}</div>` : ''}
      </div>

      <button class="btn-primary" onclick="navigateTo('inventory')" style="margin-bottom:20px">
        ${ICONS.box} Мой инвентарь
      </button>

      <div class="section-title">${ICONS.orders} История заказов</div>
      <div id="ordersContainer">
        <div class="loading-spinner"><div class="spinner"></div></div>
      </div>
    </div>
  `;

  try {
    const orders = await apiCall('/api/orders');
    const container = document.getElementById('ordersContainer');

    if (!orders || !orders.length) {
      container.innerHTML = `
        <div class="empty-state" style="padding:40px 0">
          <div class="empty-state-icon">${ICONS.orders}</div>
          <div class="empty-state-title">Нет заказов</div>
          <div class="empty-state-text">Ваши заказы появятся здесь</div>
        </div>
      `;
      return;
    }

    container.innerHTML = orders.map((order, i) => `
      <div class="order-card" onclick="showOrderDetail(${order.id})" style="animation: itemSlideIn 0.3s ease ${i * 0.05}s both">
        <div class="order-header">
          <span class="order-number">Заказ #${order.id}</span>
          <span class="order-status status-${order.status}">${getStatusLabel(order.status)}</span>
        </div>
        <div class="order-details">
          <span class="order-date">${formatDate(order.created_at)}</span>
          <span class="order-total">${formatPrice(order.total)} ₽</span>
        </div>
        ${order.promo_code ? `<div class="order-promo">${ICONS.gift} ${order.promo_code} (−${formatPrice(order.discount)} ₽)</div>` : ''}
      </div>
    `).join('');
  } catch (e) {
    document.getElementById('ordersContainer').innerHTML = `
      <div class="empty-state"><div class="empty-state-text">Ошибка загрузки заказов</div></div>
    `;
  }
}

function getStatusLabel(status) {
  switch (status) {
    case 'pending': return 'Ожидает';
    case 'completed': return 'Завершён';
    case 'cancelled': return 'Отклонён';
    default: return status;
  }
}

async function showOrderDetail(orderId) {
  try {
    const orders = await apiCall('/api/orders');
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const items = order.items || [];
    const html = `
      <div class="order-detail-section">
        <div class="order-detail-status status-${order.status}">${getStatusLabel(order.status)}</div>
        <div class="order-detail-date">${formatDate(order.created_at)}</div>
      </div>

      <div class="order-items-list">
        ${items.map(item => `
          <div class="order-item-row">
            <span class="order-item-name">${escapeHtml(item.product_name || 'Товар')}</span>
            <span class="order-item-qty">× ${item.quantity}</span>
            <span class="order-item-price">${formatPrice(item.price * item.quantity)} ₽</span>
          </div>
        `).join('')}
      </div>

      <div class="order-summary-row">
        <span>Сумма</span>
        <span>${formatPrice(order.total + (order.discount || 0))} ₽</span>
      </div>
      ${order.discount > 0 ? `
        <div class="order-summary-row">
          <span>Скидка (${order.promo_code})</span>
          <span class="cart-discount">−${formatPrice(order.discount)} ₽</span>
        </div>
      ` : ''}
      <div class="order-summary-row total">
        <span>Итого</span>
        <span>${formatPrice(order.total)} ₽</span>
      </div>
    `;

    openModal(`Заказ #${order.id}`, html);
  } catch (e) {
    showToast('Ошибка загрузки заказа', 'error');
  }
}
