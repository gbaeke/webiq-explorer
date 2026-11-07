import { searchNewsMutation } from '@/client/@tanstack/react-query.gen'
import type { NewsSearchIn } from '@/client/types.gen'
import { Explorer } from '@/components/Explorer'
import { Locale, Num, OptText, Section, Select, Text } from '@/components/fields'
import { NewsResults } from '@/components/results'
import { useForm, useWebIQCall } from '@/lib/calls'

export function News() {
  const [form, set] = useForm<NewsSearchIn>({
    query: '',
    maxResults: 10,
    language: 'en',
    region: 'US',
    contentFormat: 'passage',
    maxLength: 3000,
  })
  const call = useWebIQCall(searchNewsMutation())
  return (
    <Explorer
      title="News search"
      endpoint="search/news"
      docs="https://learn.microsoft.com/web-iq/reference/news-search"
      intro="Fresh news articles with publisher, thumbnail and grounding content."
      body={form}
      canRun={!!form.query.trim()}
      onRun={() => call.mutate({ body: form })}
      state={call}
      results={NewsResults}
      form={
        <>
          <Text
            label="Query"
            multiline
            value={form.query}
            onChange={set('query')}
            placeholder="latest VC funding in tech"
          />
          <Num label="Max results" min={1} max={20} value={form.maxResults} onChange={set('maxResults')} />
          <Locale language={form.language} region={form.region} onLanguage={set('language')} onRegion={set('region')} />
          <OptText
            label="Location"
            placeholder="lat:50.85;long:4.35"
            value={form.location}
            onChange={set('location')}
          />
          <Section title="Content">
            <Select
              label="Content format"
              hint="others need full document access"
              options={['passage', 'text', 'html', 'markdown'] as const}
              value={form.contentFormat}
              onChange={set('contentFormat')}
            />
            <Num
              label="Max length per result"
              hint="chars"
              min={1}
              max={500000}
              value={form.maxLength}
              onChange={set('maxLength')}
            />
          </Section>
        </>
      }
    />
  )
}
