let casesData = [];
let inventoryData = [];

async function renderCases() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div class="page">
      <div class="section-header">
        <div class="section-title">${ICONS.gift} Кейсы</div>
        <div id="casesBalance" class="cases-balance-display">
          <div class="loading-spinner-small"><div class="spinner"></div></div>
        </div>
      </div>
      <div id="casesGrid" class="products-grid">
        <div class="loading-spinner"><div class="spinner"></div></div>
      </div>
    </div>
  `;

  try {
    const [cases, balanceData] = await Promise.all([
      apiCall('/api/cases'),
      apiCall('/api/inventory/stars').catch(() => ({ balance: 0 }))
    ]);
    
    casesData = cases;
    
    const balanceEl = document.getElementById('casesBalance');
    if (balanceEl) {
      balanceEl.innerHTML = `
        <img src="/assets/icons/tg_star_icon.png" alt="⭐" class="star-icon">
        <span class="balance-amount">${balanceData.balance || 0}</span>
      `;
    }
    
    renderCasesGrid();
  } catch (e) {
    document.getElementById('casesGrid').innerHTML = `<div class="empty-state"><div class="empty-state-text">Ошибка загрузки</div></div>`;
  }
}

function renderCasesGrid() {
  const grid = document.getElementById('casesGrid');

  if (!casesData.length) {
    grid.innerHTML = `
      <div class="empty-state-full">
        <div class="empty-state-icon">${ICONS.gift}</div>
        <div class="empty-state-title">Кейсов пока нет</div>
      </div>
    `;
    grid.style.display = 'flex';
    grid.style.justifyContent = 'center';
    grid.style.alignItems = 'center';
    grid.style.minHeight = '400px';
    return;
  }

  grid.style.display = 'grid';
  grid.innerHTML = casesData.map((c, i) => `
    <div class="case-card" onclick="openCaseDetail(${c.id})" style="animation: cardIn 0.35s var(--ease) ${i * 0.05}s both">
      <div class="case-image">
        ${c.image_url
      ? `<img src="${c.image_url}" alt="${escapeHtml(c.name)}">`
      : `<div class="case-image-placeholder">${ICONS.gift}</div>`
    }
      </div>
      <div class="case-info">
        <div class="case-name">${escapeHtml(c.name)}</div>
        ${c.description ? `<div class="case-desc">${escapeHtml(c.description)}</div>` : ''}
        <div class="case-bottom">
          <div class="case-price">
            <img src="/assets/icons/tg_star_icon.png" alt="⭐" class="stars-icon-img">
            ${c.price}
          </div>
          <div class="case-items-count">${c.items_count} ${pluralize(c.items_count, 'предмет', 'предмета', 'предметов')}</div>
        </div>
      </div>
    </div>
  `).join('');
}

async function openCaseDetail(caseId) {
  try {
    const caseData = await apiCall(`/api/cases/${caseId}`);

    if (!caseData) {
      console.error('Invalid case data:', caseData);
      showToast('Ошибка загрузки кейса', 'error');
      return;
    }

    if (!caseData.items) {
      caseData.items = [];
    }

    window.__currentCaseData = caseData;

    openModal(caseData.name, `
      <div class="case-detail">
        ${caseData.image_url ? `
          <div class="case-detail-image">
            <img src="${caseData.image_url}" alt="${escapeHtml(caseData.name)}">
          </div>
        ` : ''}
        
        ${caseData.description ? `<div class="case-detail-desc">${escapeHtml(caseData.description)}</div>` : ''}
        
        <div class="case-detail-price">
          <img src="/assets/icons/tg_star_icon.png" alt="⭐" class="stars-icon-img">
          ${caseData.price} звёзд
        </div>

        <div class="case-items-title">Возможные призы:</div>
        <div class="case-items-list">
          ${caseData.items.map(item => `
            <div class="case-item">
              <div class="case-item-image">
                ${item.image_url
        ? `<img src="${item.image_url}" alt="${escapeHtml(item.name)}">`
        : `<div class="case-item-placeholder">${ICONS.box}</div>`
      }
              </div>
              <div class="case-item-info">
                <div class="case-item-name">${escapeHtml(item.name)}</div>
                ${currentUser && currentUser.is_admin ? `<div class="case-item-chance">${item.chance.toFixed(2)}%</div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>

        <button class="btn-primary" onclick="openCase(${caseId}, ${caseData.price})">
          ${ICONS.gift} Открыть за ${caseData.price} <img src="/assets/icons/tg_star_icon.png" alt="⭐" class="stars-icon-inline">
        </button>
      </div>
    `);
  } catch (e) {
    console.error('Error loading case:', e);
    showToast('Ошибка загрузки кейса: ' + (e.message || 'неизвестная ошибка'), 'error');
  }
}

async function openCase(caseId, price) {
  try {
    const isAdmin = currentUser && currentUser.is_admin;

    async function startCaseOpening() {
      showCaseOpeningAnimation();

      const result = await apiCall(`/api/cases/${caseId}/complete-payment`, 'POST');

      animateRouletteToItem(result.item);

      setTimeout(() => {
        showWonItem(result.item);
      }, 6000);
    }

    if (isAdmin) {
      await startCaseOpening();
      return;
    }

    if (window.Telegram && window.Telegram.WebApp) {
      const tg = window.Telegram.WebApp;

      try {
        const invoiceData = await apiCall(`/api/cases/${caseId}/create-invoice`, 'POST');

        if (invoiceData.free) {
          await startCaseOpening();
          return;
        }

        if (invoiceData.invoiceLink) {
          closeModal();

          tg.openInvoice(invoiceData.invoiceLink, async (status) => {
            if (status === 'paid') {
              showCaseOpeningAnimation();

              try {
                const result = await apiCall(`/api/cases/${caseId}/complete-payment`, 'POST');
                animateRouletteToItem(result.item);
                setTimeout(() => {
                  showWonItem(result.item);
                }, 6000);
              } catch (e) {
                resetModalOverlay();
                showToast('Ошибка получения приза', 'error');
              }
            } else if (status === 'cancelled') {
              showToast('Оплата отменена', 'error');
            } else if (status === 'failed') {
              showToast('Ошибка оплаты', 'error');
            }
          });
        } else {
          showToast('Ошибка создания счета', 'error');
        }
      } catch (e) {
        console.error('Invoice error:', e);
        showToast('Ошибка создания счета', 'error');
      }
    } else {
      if (isAdmin) {
        await startCaseOpening();
      } else {
        showToast('Telegram WebApp недоступен', 'error');
      }
    }
  } catch (e) {
    console.error('Open case error:', e);
    resetModalOverlay();
    showToast(e.message || 'Ошибка открытия кейса', 'error');
  }
}

function resetModalOverlay() {
  const overlay = document.getElementById('modalOverlay');
  overlay.classList.remove('active');
  overlay.style.animation = '';
  overlay.onclick = function (event) {
    if (event.target === this) closeModal();
  };
  overlay.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3 id="modalTitle"></h3>
        <button class="modal-close" onclick="closeModal()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div class="modal-body" id="modalBody"></div>
    </div>
  `;
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function showCaseOpeningAnimation() {
  const overlay = document.getElementById('modalOverlay');

  overlay.onclick = null;

  const caseData = window.__currentCaseData;
  if (!caseData || !caseData.items || caseData.items.length === 0) {
    overlay.innerHTML = `
      <div class="case-opening-animation">
        <div class="case-opening-spinner">
          <div class="case-opening-icon">${ICONS.gift}</div>
        </div>
        <div class="case-opening-text">Открываем кейс...</div>
      </div>
    `;
    overlay.classList.add('active');
    return;
  }

  const items = caseData.items;
  const ITEM_WIDTH = 120;
  const totalRepeats = 45;

  let itemsHtml = '';
  for (let r = 0; r < totalRepeats; r++) {
    const shuffled = shuffleArray(items);
    shuffled.forEach((item, idx) => {
      itemsHtml += `
        <div class="roulette-item" data-product-id="${item.product_id || item.id}">
          <div class="roulette-item-image">
            ${item.image_url
          ? `<img src="${item.image_url}" alt="${escapeHtml(item.name)}">`
          : `<div class="roulette-item-placeholder">${ICONS.box}</div>`
        }
          </div>
          <div class="roulette-item-name">${escapeHtml(item.name)}</div>
        </div>
      `;
    });
  }

  overlay.innerHTML = `
    <div class="case-opening-animation">
      <div class="case-opening-roulette">
        <div class="roulette-items" id="rouletteItems">${itemsHtml}</div>
        <div class="roulette-indicator"></div>
      </div>
      <div class="case-opening-text">Открываем кейс...</div>
    </div>
  `;

  overlay.classList.add('active');
  overlay.style.animation = '';
}

function animateRouletteToItem(wonItem) {
  const rouletteItems = document.getElementById('rouletteItems');
  if (!rouletteItems) return;

  const caseData = window.__currentCaseData;
  if (!caseData || !caseData.items) return;

  const items = caseData.items;
  const ITEM_WIDTH = 120;
  const totalItemCount = items.length * 45;

  const allRouletteItems = rouletteItems.querySelectorAll('.roulette-item');
  const wonProductId = String(wonItem.id);

  const wonPositions = [];
  allRouletteItems.forEach((el, idx) => {
    if (el.dataset.productId === wonProductId) {
      wonPositions.push(idx);
    }
  });

  let targetIdx;
  if (wonPositions.length > 0) {
    const minTarget = Math.floor(totalItemCount * 0.75);
    const maxTarget = Math.floor(totalItemCount * 0.85);
    const candidates = wonPositions.filter(p => p >= minTarget && p <= maxTarget);
    if (candidates.length > 0) {
      targetIdx = candidates[Math.floor(Math.random() * candidates.length)];
    } else {
      const idealPos = Math.floor(totalItemCount * 0.8);
      targetIdx = wonPositions.reduce((best, p) =>
        Math.abs(p - idealPos) < Math.abs(best - idealPos) ? p : best
        , wonPositions[0]);
    }
  } else {
    targetIdx = Math.floor(totalItemCount * 0.8);
  }

  const containerWidth = rouletteItems.parentElement.offsetWidth;
  const centerOfContainer = containerWidth / 2;

  const jitter = (Math.random() - 0.5) * (ITEM_WIDTH * 0.4);

  const targetOffset = -(targetIdx * ITEM_WIDTH) + centerOfContainer - (ITEM_WIDTH / 2) + jitter;

  rouletteItems.style.transition = 'none';
  rouletteItems.style.transform = `translateX(${centerOfContainer}px) translateY(-50%)`;

  rouletteItems.offsetHeight;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      rouletteItems.style.transition = 'transform 5.2s cubic-bezier(0.15, 0.6, 0.08, 1)';
      rouletteItems.style.transform = `translateX(${targetOffset}px) translateY(-50%)`;
    });
  });

  setTimeout(() => {
    if (allRouletteItems[targetIdx]) {
      allRouletteItems[targetIdx].classList.add('roulette-item-winner');
    }
    const textEl = document.querySelector('.case-opening-text');
    if (textEl) textEl.textContent = '';
  }, 5300);
}

function showWonItem(item) {
  const overlay = document.getElementById('modalOverlay');

  overlay.onclick = function (event) {
    if (event.target === this) {
      resetModalOverlay();
      navigateTo('cases');
    }
  };

  overlay.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>🎉 Поздравляем!</h3>
        <button class="modal-close" onclick="resetModalOverlay(); navigateTo('cases')">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M15 5L5 15M5 5l10 10"/>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="won-item-container">
          <div class="won-item-image">
            ${item.image_url
      ? `<img src="${item.image_url}" alt="${escapeHtml(item.name)}">`
      : `<div class="won-item-placeholder">${ICONS.box}</div>`
    }
          </div>
          <div class="won-item-name">${escapeHtml(item.name)}</div>
          <div class="won-item-text">Приз добавлен в инвентарь!</div>
          <div class="won-item-actions">
            <button class="btn-primary" onclick="resetModalOverlay(); navigateTo('inventory')">
              ${ICONS.box} Открыть инвентарь
            </button>
            <button class="btn-secondary" onclick="resetModalOverlay(); navigateTo('cases')">
              Продолжить
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  overlay.classList.add('active');
  overlay.style.animation = '';
}

async function renderInventory() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div class="page">
      <div class="section-title">${ICONS.box} Инвентарь</div>
      <div id="inventoryBalance"></div>
      <div id="inventoryContent">
        <div class="loading-spinner"><div class="spinner"></div></div>
      </div>
    </div>
  `;

  try {
    const [items, balanceData] = await Promise.all([
      apiCall('/api/inventory'),
      apiCall('/api/inventory/stars').catch(() => ({ balance: 0 }))
    ]);

    inventoryData = items;

    const balanceEl = document.getElementById('inventoryBalance');
    if (balanceEl) {
      balanceEl.innerHTML = `
        <div class="inventory-balance-card">
          <img src="/assets/icons/tg_star_icon.png" alt="⭐" class="stars-icon-img">
          <span class="inventory-balance-amount">${balanceData.balance || 0}</span>
          <span class="inventory-balance-label">звёзд на балансе</span>
        </div>
      `;
    }

    renderInventoryItems();
  } catch (e) {
    document.getElementById('inventoryContent').innerHTML = `<div class="empty-state"><div class="empty-state-text">Ошибка загрузки</div></div>`;
  }
}

function renderInventoryItems() {
  const container = document.getElementById('inventoryContent');

  if (!inventoryData.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div class="inventory-list">
      ${inventoryData.map((item, i) => `
        <div class="inventory-item" style="animation: itemSlideIn 0.3s ease ${i * 0.04}s both">
          <div class="inventory-item-image">
            ${item.image_url
      ? `<img src="${item.image_url}" alt="${escapeHtml(item.name)}">`
      : `<div class="inventory-item-placeholder">${ICONS.box}</div>`
    }
          </div>
          <div class="inventory-item-info">
            <div class="inventory-item-name">${escapeHtml(item.name)}</div>
            ${item.case_name ? `<div class="inventory-item-case">Из: ${escapeHtml(item.case_name)}</div>` : ''}
            <div class="inventory-item-price">Цена: ${formatPrice(item.price)} ₽</div>
          </div>
          <div class="inventory-item-actions">
            <button class="btn-inventory claim" onclick="claimItem(${item.id})">
              ${ICONS.check} Забрать
            </button>
            <button class="btn-inventory sell" onclick="sellItem(${item.id}, ${item.price})">
              💰 Продать
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

async function claimItem(itemId) {
  if (!confirm('Забрать этот приз? Вы будете перенаправлены в чат с продавцом.')) return;

  try {
    const result = await apiCall(`/api/inventory/${itemId}/claim`, 'POST');
    
    console.log('Claim result:', result);
    
    if (result.success) {
      showToast('Приз оформлен! Перенаправляем в чат...', 'success');
      
      let message = result.message;
      if (!message || message.includes('undefined')) {
        message = `Здравствуйте! 👋\n\n🎁 Я выиграл приз из кейса!\n\nЗаказ #${result.orderId || 'N/A'}`;
      }
      
      console.log('Message to send:', message);
      
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
      
      setTimeout(() => {
        renderInventory();
      }, 1000);
    }
  } catch (e) {
    console.error('Claim error:', e);
    showToast(e.message || 'Ошибка', 'error');
  }
}

async function sellItem(itemId, price) {
  const sellPrice = Math.floor(price * 0.5);
  if (!confirm(`Продать за ${sellPrice} звёзд?`)) return;

  try {
    const result = await apiCall(`/api/inventory/${itemId}/sell`, 'POST');
    showToast(`Продано! +${result.stars} на баланс`, 'success');

    if (typeof currentUser !== 'undefined' && currentUser) {
      try {
        const balanceData = await apiCall('/api/inventory/stars');
        currentUser.stars_balance = balanceData.balance || 0;
      } catch (e) { }
    }

    await renderInventory();
  } catch (e) {
    showToast(e.message || 'Ошибка продажи', 'error');
  }
}

function pluralize(n, one, few, many) {
  n = Math.abs(n) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return many;
  if (n1 > 1 && n1 < 5) return few;
  if (n1 === 1) return one;
  return many;
}
