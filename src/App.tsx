import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainPage } from '@/pages/main-page';
import { CategoryPage } from '@/pages/category-page';
import { AssetDetailPage } from '@/pages/asset-detail-page';
import { AddAssetPage } from '@/pages/add-asset-page';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/category/:type" element={<CategoryPage />} />
        <Route path="/asset/:id" element={<AssetDetailPage />} />
        <Route path="/add-asset" element={<AddAssetPage />} />
      </Routes>
    </BrowserRouter>
  );
}
