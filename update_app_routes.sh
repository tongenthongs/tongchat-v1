sed -i 's/import CatalogDynamicPage from ".\/pages\/catalog\/CatalogDynamicPage";/import ExistingCatalogView from ".\/components\/products\/ExistingCatalogView";/g' src/App.tsx
sed -i 's/<Route path="\/gpdragdrivesim" element={<CatalogDynamicPage \/>} \/>/<Route path="\/gpdragdrivesim" element={<ExistingCatalogView categoryType="GP_DRAGDRIVE" \/>} \/>/g' src/App.tsx
sed -i 's/<Route path="\/gpcdid" element={<CatalogDynamicPage \/>} \/>/<Route path="\/gpcdid" element={<ExistingCatalogView categoryType="GP_CDID" \/>} \/>/g' src/App.tsx
sed -i 's/<Route path="\/jokidds" element={<CatalogDynamicPage \/>} \/>/<Route path="\/jokidds" element={<ExistingCatalogView categoryType="JOKI_DRAGDRIVE" \/>} \/>/g' src/App.tsx
sed -i 's/<Route path="\/jokicdid" element={<CatalogDynamicPage \/>} \/>/<Route path="\/jokicdid" element={<ExistingCatalogView categoryType="JOKI_CDID" \/>} \/>/g' src/App.tsx
