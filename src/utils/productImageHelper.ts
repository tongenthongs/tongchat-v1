import { getCatalogOrCategoryImage } from './productImageResolver';

export const getProductOrCategoryImage = (item: any, catalogs = [], categories = []) => {
  return getCatalogOrCategoryImage(item, catalogs, categories);
};
