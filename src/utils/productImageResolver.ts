/**
 * Universal safe product and category image resolver.
 * Evaluates in priority:
 * 1. Direct image property from order/review item (imageUrl, productImage, itemImage, image, thumbnail)
 * 2. Nested items array (e.g. items[0].imageUrl)
 * 3. Specific package/item match in master catalogs (including catalog.pricelist / packages sub-arrays)
 * 4. Parent game catalog image match by game title / category
 * 5. Master category image match
 * 6. Returns null if no valid image is found (enables clean conditional rendering with zero placeholder boxes)
 */
export const getCatalogOrCategoryImage = (
  item: any,
  catalogList: any[] = [],
  categoryList: any[] = []
): string | null => {
  if (!item) return null;

  // Handle case where item itself is a URL string
  if (typeof item === 'string') {
    if (item.startsWith('http://') || item.startsWith('https://') || item.startsWith('/')) {
      return item;
    }
    return null;
  }

  // 1. Direct image property from item payload
  const directImage = item.imageUrl || item.productImage || item.itemImage || item.packageImage || item.image || item.thumbnail || item.iconUrl || item.icon;
  if (directImage && typeof directImage === 'string' && (directImage.startsWith('http') || directImage.startsWith('/'))) {
    return directImage;
  }

  // 2. Direct image from first item if items array exists
  if (Array.isArray(item.items) && item.items.length > 0) {
    const firstItem = item.items[0];
    if (firstItem) {
      const nestedImg = firstItem.imageUrl || firstItem.productImage || firstItem.itemImage || firstItem.image || firstItem.thumbnail;
      if (nestedImg && typeof nestedImg === 'string' && (nestedImg.startsWith('http') || nestedImg.startsWith('/'))) {
        return nestedImg;
      }
    }
  }

  const safeCatalogs = Array.isArray(catalogList) ? catalogList : [];
  const safeCategories = Array.isArray(categoryList) ? categoryList : [];

  const targetName = (item.packageName || item.productName || item.itemName || item.name || item.serviceName || item.itemGift || item.giftItemName || item.title || '').toString().toLowerCase().trim();
  const targetGame = (item.gameName || item.gameTitle || item.category || item.game || '').toString().toLowerCase().trim();
  const targetCatalogId = (item.catalogId || item.packageId || item.productId || item.itemId || item.id || '').toString().trim();

  // 3. Lookup in Master Catalogs
  if (safeCatalogs.length > 0) {
    let fallbackGameImg: string | null = null;

    for (const cat of safeCatalogs) {
      if (!cat) continue;
      const catId = (cat.id || '').toString().trim();
      const catTitle = (cat.title || cat.name || cat.gameName || '').toString().toLowerCase().trim();
      const catGameImg = cat.imageUrl || cat.image || cat.thumbnail || cat.banner || null;

      // Check sub-pricelist or packages array within catalog
      const subPackages = Array.isArray(cat.pricelist) ? cat.pricelist : (Array.isArray(cat.packages) ? cat.packages : []);
      if (subPackages.length > 0) {
        for (const pkg of subPackages) {
          if (!pkg) continue;
          const pkgId = (pkg.id || '').toString().trim();
          const pkgName = (pkg.name || pkg.title || '').toString().toLowerCase().trim();
          
          const isIdMatch = targetCatalogId && (pkgId === targetCatalogId || `${catId}__${pkgId}` === targetCatalogId);
          const isNameMatch = targetName && pkgName && (targetName === pkgName || targetName.includes(pkgName) || pkgName.includes(targetName));

          if (isIdMatch || isNameMatch) {
            const pkgImg = pkg.imageUrl || pkg.image || pkg.thumbnail || catGameImg;
            if (pkgImg && typeof pkgImg === 'string' && (pkgImg.startsWith('http') || pkgImg.startsWith('/'))) {
              return pkgImg;
            }
          }
        }
      }

      // Check direct catalog match
      const isDirectCatIdMatch = targetCatalogId && catId === targetCatalogId;
      const isDirectCatNameMatch = targetName && catTitle && (targetName === catTitle || targetName.includes(catTitle) || catTitle.includes(targetName));

      if (isDirectCatIdMatch || isDirectCatNameMatch) {
        if (catGameImg && typeof catGameImg === 'string' && (catGameImg.startsWith('http') || catGameImg.startsWith('/'))) {
          return catGameImg;
        }
      }

      // Track game category image fallback if game title matches
      if (targetGame && catTitle && (catTitle === targetGame || catTitle.includes(targetGame) || targetGame.includes(catTitle))) {
        if (catGameImg && typeof catGameImg === 'string' && (catGameImg.startsWith('http') || catGameImg.startsWith('/'))) {
          fallbackGameImg = catGameImg;
        }
      }
    }

    if (fallbackGameImg) {
      return fallbackGameImg;
    }
  }

  // 4. Lookup in Master Categories
  if (safeCategories.length > 0 && targetGame) {
    const matchedCategory = safeCategories.find(cat => {
      if (!cat) return false;
      const catName = (cat.name || cat.gameName || cat.title || '').toString().toLowerCase().trim();
      return catName && (catName === targetGame || targetGame.includes(catName) || catName.includes(targetGame));
    });

    if (matchedCategory) {
      const catImg = matchedCategory.imageUrl || matchedCategory.image || matchedCategory.iconUrl || matchedCategory.banner;
      if (catImg && typeof catImg === 'string' && (catImg.startsWith('http') || catImg.startsWith('/'))) {
        return catImg;
      }
    }
  }

  // 5. If not found, return null (never a placeholder box)
  return null;
};

