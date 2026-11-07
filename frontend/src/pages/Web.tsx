import { searchWebMutation } from '@/client/@tanstack/react-query.gen'
import type { WebSearchIn } from '@/client/types.gen'
import { Explorer } from '@/components/Explorer'
import { Locale, Num, OptText, Section, Select, Text } from '@/components/fields'
import { WebResults } from '@/components/results'
import { useForm, useWebIQCall } from '@/lib/calls'

export function Web() {
  const [form, set] = useForm<WebSearchIn>({
    query: '',
    maxResults: 10,
    language: 'en',
    region: 'US',
    contentFormat: 'passage',
    maxLength: 3000,
    safeSearch: 'strict',
  })
  const call = useWebIQCall(searchWebMutation())
  return (
    <Explorer
      title="Web search"
      endpoint="search/web"
      docs="https://learn.microsoft.com/web-iq/reference/web-search"
      intro="Ranked web pages with query-focused grounding passages."
      body={form}
      canRun={!!form.query.trim()}
      onRun={() => call.mutate({ body: form })}
      state={call}
      results={WebResults}
      form={
        <>
          <Text
            label="Query"
            hint="site: and -site: work"
            multiline
            value={form.query}
            onChange={set('query')}
            placeholder="latest trends in LLM RAG"
          />
          <Num label="Max results" min={1} max={50} value={form.maxResults} onChange={set('maxResults')} />
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
              hint="chars, ≤3000 for passages"
              min={1}
              max={500000}
              value={form.maxLength}
              onChange={set('maxLength')}
            />
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
