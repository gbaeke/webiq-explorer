import { searchVideosMutation } from '@/client/@tanstack/react-query.gen'
import type { VideoSearchIn } from '@/client/types.gen'
import { Explorer } from '@/components/Explorer'
import { Check, Chips, Locale, Num, OptText, Section, Select, Text } from '@/components/fields'
import { VideoResults } from '@/components/results'
import { useForm, useWebIQCall } from '@/lib/calls'

export function Videos() {
  const [form, set] = useForm<VideoSearchIn>({
    query: '',
    maxResults: 30,
    language: 'en',
    region: 'US',
    enablePlaylist: false,
    safeSearch: 'strict',
  })
  const call = useWebIQCall(searchVideosMutation())
  return (
    <Explorer
      title="Video search"
      endpoint="search/videos"
      docs="https://learn.microsoft.com/web-iq/reference/video-search"
      intro="Videos with AI summaries, moments (chapters), view counts and embedding info."
      body={form}
      canRun={!!form.query.trim()}
      onRun={() => call.mutate({ body: form })}
      state={call}
      results={VideoResults}
      form={
        <>
          <Text label="Query" value={form.query} onChange={set('query')} placeholder="Azure Container Apps tutorial" />
          <Num label="Max results" min={1} max={30} value={form.maxResults} onChange={set('maxResults')} />
          <Locale language={form.language} region={form.region} onLanguage={set('language')} onRegion={set('region')} />
          <Section title="Filters">
            <OptText
              label="Freshness"
              hint="week, month, year or a range"
              placeholder="2026-10-01/.."
              value={form.freshness}
              onChange={set('freshness')}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Duration"
                optional
                options={['short', 'medium', 'long'] as const}
                value={form.duration}
                onChange={set('duration')}
              />
              <Select
                label="Min resolution"
                optional
                options={['360p', '480p', '720p', '1080p'] as const}
                value={form.resolution}
                onChange={set('resolution')}
              />
            </div>
            <Chips
              label="Embeddable"
              options={['player'] as const}
              value={form.embeddable}
              onChange={set('embeddable')}
            />
            <Check label="Include playlists" value={form.enablePlaylist} onChange={set('enablePlaylist')} />
            <Select
              label="SafeSearch"
              options={['strict', 'off'] as const}
              value={form.safeSearch}
              onChange={set('safeSearch')}
            />
          </Section>
        </>
      }
    />
  )
}
