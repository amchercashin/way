import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainPage } from '@/pages/main-page';
import { CategoryPage } from '@/pages/category-page';
import { AssetDetailPage } from '@/pages/asset-detail-page';
import { AddAssetPage } from '@/pages/add-asset-page';
import { ImportPage } from '@/pages/import-page';
import { ImportAIPage } from '@/pages/import-ai-page';
import { ImportFilePage } from '@/pages/import-file-page';
import { ImportPreviewPage } from '@/pages/import-preview-page';
import { SettingsPage } from '@/pages/settings-page';
import { BackupPage } from '@/pages/backup-page';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/category/:type" element={<CategoryPage />} />
        <Route path="/asset/:id" element={<AssetDetailPage />} />
        <Route path="/add-asset" element={<AddAssetPage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/import/ai" element={<ImportAIPage />} />
        <Route path="/import/file" element={<ImportFilePage />} />
        <Route path="/import/preview" element={<ImportPreviewPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/backup" element={<BackupPage />} />
      </Routes>
    </BrowserRouter>
  );
}
