import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell.tsx'
import { ClassesPage } from './pages/ClassesPage.tsx'
import { DatasetPage } from './pages/DatasetPage.tsx'
import { ExportPage } from './pages/ExportPage.tsx'
import { ModelsPage } from './pages/ModelsPage.tsx'
import { ProjectLayout } from './pages/ProjectLayout.tsx'
import { ProjectsPage } from './pages/ProjectsPage.tsx'
import { WorkbenchPage } from './pages/WorkbenchPage.tsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<ProjectsPage />} />
          <Route path="/models" element={<ModelsPage />} />
          <Route path="/projects/:projectId" element={<ProjectLayout />}>
            <Route index element={<DatasetPage />} />
            <Route path="classes" element={<ClassesPage />} />
            <Route path="export" element={<ExportPage />} />
          </Route>
        </Route>
        <Route
          path="/projects/:projectId/annotate/:imageId"
          element={<WorkbenchPage />}
        />
        <Route path="*" element={<AppShell />} />
      </Routes>
    </BrowserRouter>
  )
}
