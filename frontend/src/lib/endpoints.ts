import { FileSearch, Film, Globe, Image, Newspaper, Sparkles } from 'lucide-react'

/** The explorer's pages, one per Web IQ endpoint: the navigation and the overview both read this. */
export const endpoints = [
  { to: '/web', label: 'Web', icon: Globe, path: 'search/web', summary: 'Ranked pages with grounding passages.' },
  {
    to: '/news',
    label: 'News',
    icon: Newspaper,
    path: 'search/news',
    summary: 'Fresh articles with publisher and thumbnail.',
  },
  {
    to: '/images',
    label: 'Images',
    icon: Image,
    path: 'search/images',
    summary: 'Images with size, aspect, color and watermark filters.',
  },
  {
    to: '/videos',
    label: 'Videos',
    icon: Film,
    path: 'search/videos',
    summary: 'Videos with AI summaries, moments and playlists.',
  },
  {
    to: '/browse',
    label: 'Browse',
    icon: FileSearch,
    path: 'browse',
    summary: 'Content of one URL, with optional live crawl.',
  },
  {
    to: '/auto',
    label: 'Auto (beta)',
    icon: Sparkles,
    path: 'auto',
    summary: 'Typed evidence with citations, chosen by Web IQ.',
  },
] as const
