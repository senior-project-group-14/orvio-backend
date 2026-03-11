const CART_TTL_MS = 1000 * 60 * 60; // 60 minutes
const cartStore = new Map();

function nowIso() {
  return new Date().toISOString();
}

function nextExpiry() {
  return Date.now() + CART_TTL_MS;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeQuantity(value) {
  const quantity = Math.floor(toNumber(value, 0));
  return Math.max(0, quantity);
}

function normalizeMoney(value) {
  const amount = toNumber(value, 0);
  return Number(amount.toFixed(2));
}

function normalizeItem(item) {
  const quantity = normalizeQuantity(item.quantity);
  const unitPrice = normalizeMoney(item.unit_price);
  return {
    product_id: item.product_id,
    ai_label: item.ai_label || null,
    name: item.name,
    brand: item.brand || null,
    quantity,
    unit_price: unitPrice,
    subtotal: normalizeMoney(quantity * unitPrice),
    metadata: item.metadata || {},
  };
}

function toPublicCart(entry) {
  return {
    transaction_id: entry.transaction_id,
    device_id: entry.device_id,
    status_id: entry.status_id,
    cart: entry.cart,
    total_price: entry.total_price,
    version: entry.version,
    last_update_source: entry.last_update_source,
    updated_at: entry.updated_at,
  };
}

function touch(entry, source) {
  entry.updated_at = nowIso();
  entry.last_update_source = source;
  entry.version += 1;
  entry.expires_at = nextExpiry();
}

function recompute(entry) {
  entry.cart = entry.cart
    .map(normalizeItem)
    .filter((item) => item.quantity > 0);
  entry.total_price = normalizeMoney(
    entry.cart.reduce((sum, item) => sum + item.subtotal, 0)
  );
}

function initSessionCart({ transaction_id, device_id, status_id }) {
  const current = cartStore.get(transaction_id);
  if (current) {
    current.expires_at = nextExpiry();
    return toPublicCart(current);
  }

  const entry = {
    transaction_id,
    device_id,
    status_id,
    cart: [],
    total_price: 0,
    version: 1,
    last_update_source: 'SESSION_START',
    updated_at: nowIso(),
    expires_at: nextExpiry(),
  };

  cartStore.set(transaction_id, entry);
  return toPublicCart(entry);
}

function getSessionCart(transactionId) {
  const entry = cartStore.get(transactionId);
  if (!entry) {
    return null;
  }

  if (entry.expires_at <= Date.now()) {
    cartStore.delete(transactionId);
    return null;
  }

  entry.expires_at = nextExpiry();
  return toPublicCart(entry);
}

function replaceSessionCart({ transaction_id, device_id, status_id, items, source }) {
  const entry = cartStore.get(transaction_id) || {
    transaction_id,
    device_id,
    status_id,
    cart: [],
    total_price: 0,
    version: 0,
    last_update_source: null,
    updated_at: nowIso(),
    expires_at: nextExpiry(),
  };

  entry.device_id = device_id;
  entry.status_id = status_id;
  entry.cart = Array.isArray(items) ? items : [];
  recompute(entry);
  touch(entry, source || 'SYSTEM_SYNC');

  cartStore.set(transaction_id, entry);
  return toPublicCart(entry);
}

function applyInteractionEvents({ transaction_id, device_id, status_id, events }) {
  const entry = cartStore.get(transaction_id) || {
    transaction_id,
    device_id,
    status_id,
    cart: [],
    total_price: 0,
    version: 0,
    last_update_source: null,
    updated_at: nowIso(),
    expires_at: nextExpiry(),
  };

  entry.device_id = device_id;
  entry.status_id = status_id;

  const itemMap = new Map(entry.cart.map((item) => [item.product_id, { ...item }]));

  for (const event of events) {
    const existing = itemMap.get(event.product_id);
    const currentQty = existing ? normalizeQuantity(existing.quantity) : 0;
    const nextQty = Math.max(0, currentQty + event.quantity_delta);

    if (nextQty === 0) {
      itemMap.delete(event.product_id);
      continue;
    }

    const unitPrice = normalizeMoney(
      existing ? existing.unit_price : event.unit_price
    );

    itemMap.set(event.product_id, {
      product_id: event.product_id,
      ai_label: existing?.ai_label || null,
      name: event.name,
      brand: event.brand || null,
      quantity: nextQty,
      unit_price: unitPrice,
      subtotal: normalizeMoney(nextQty * unitPrice),
      metadata: {
        last_event_id: event.event_id,
        last_event_at: event.timestamp,
      },
    });
  }

  entry.cart = Array.from(itemMap.values());
  recompute(entry);
  touch(entry, 'SESSION_INTERACTION');

  cartStore.set(transaction_id, entry);
  return toPublicCart(entry);
}

function consumeSessionCart(transactionId) {
  const cart = getSessionCart(transactionId);
  if (!cart) {
    return null;
  }

  cartStore.delete(transactionId);
  return cart;
}

function clearSessionCart(transactionId) {
  cartStore.delete(transactionId);
}

setInterval(() => {
  const now = Date.now();
  for (const [transactionId, entry] of cartStore.entries()) {
    if (entry.expires_at <= now) {
      cartStore.delete(transactionId);
    }
  }
}, 60 * 1000).unref();

module.exports = {
  initSessionCart,
  getSessionCart,
  replaceSessionCart,
  applyInteractionEvents,
  consumeSessionCart,
  clearSessionCart,
};
