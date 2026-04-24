const prisma = require('../config/database');

let productsByAiLabel = new Map();
let cacheLoaded = false;

function normalizeAiLabel(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function mapProduct(product) {
  return {
    product_id: product.product_id,
    ai_label: product.ai_label,
    name: product.name,
    brand: product.brand?.brand_name || null,
    unit_price: Number(product.unit_price || 0),
  };
}

async function refreshProductCache() {
  const products = await prisma.product.findMany({
    where: {
      is_active: true,
      ai_label: {
        not: null,
      },
    },
    include: {
      brand: true,
    },
  });

  const nextMap = new Map();
  for (const product of products) {
    const aiLabel = normalizeAiLabel(product.ai_label);
    if (!aiLabel) {
      continue;
    }
    nextMap.set(aiLabel, mapProduct(product));
  }

  productsByAiLabel = nextMap;
  cacheLoaded = true;
  return productsByAiLabel.size;
}

function getProductByAiLabel(aiLabel) {
  return productsByAiLabel.get(normalizeAiLabel(aiLabel));
}

function isProductCacheLoaded() {
  return cacheLoaded;
}

module.exports = {
  refreshProductCache,
  getProductByAiLabel,
  isProductCacheLoaded,
};
