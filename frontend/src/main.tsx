import '@/index.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'
import { Toaster } from 'sonner'
import { Shell } from '@/components/Shell'
import { setupApiClient } from '@/lib/api'
import { ThemeProvider } from '@/lib/theme'
import { Auto } from '@/pages/Auto'
import { Browse } from '@/pages/Browse'
import { Home } from '@/pages/Home'
import { Images } from '@/pages/Images'
import { News } from '@/pages/News'
import { NotFound } from '@/pages/NotFound'
import { Videos } from '@/pages/Videos'
import { Web } from '@/pages/Web'

setupApiClient()
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 10_000 } } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route element={<Shell />}>
              <Route index element={<Home />} />
              <Route path="web" element={<Web />} />
              <Route path="news" element={<News />} />
              <Route path="images" element={<Images />} />
              <Route path="videos" element={<Videos />} />
              <Route path="browse" element={<Browse />} />
              <Route path="auto" element={<Auto />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster richColors />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
