import { browseMutation } from '@/client/@tanstack/react-query.gen'
import type { BrowseIn } from '@/client/types.gen'
import { Explorer } from '@/components/Explorer'
import { Check, Locale, Num, OptText, Section, Select, Text } from '@/components/fields'
import { BrowseResult } from '@/components/results'
import { useForm, useWebIQCall } from '@/lib/calls'

export function Browse() {
  const [form, set] = useForm<BrowseIn>({
    url: '',
    contentFormat: 'passage',
    maxLength: 3000,
    liveCrawl: 'none',
    renderDynamicPages: false,
    includeWebLinks: false,
    includeImageLinks: false,
    language: 'en',
    region: 'US',
  })
  const call = useWebIQCall(browseMutation())
  const run = () => call.mutate({ body: form })
  const passage = form.contentFormat === 'passage'
  return (
    <Explorer
      title="Browse"
      endpoint="browse"
      docs="https://learn.microsoft.com/web-iq/reference/browse"
      intro="The content of one URL: query-focused passages, or the whole page with full document access."
      body={form}
      canRun={!!form.url.trim() && (!passage || !!form.query?.trim())}
      onRun={run}
      state={call}
      results={BrowseResult}
      form={
        <>
          <Text
            label="URL"
            value={form.url}
            onChange={set('url')}
            placeholder="https://learn.microsoft.com/web-iq/overview"
          />
          <OptText
            label="Query"
            hint={passage ? 'required for passage' : 'optional'}
            multiline
            value={form.query}
            onChange={set('query')}
            placeholder="How fast is Web IQ"
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
              label="Max length"
              hint="chars"
              min={1}
              max={500000}
              value={form.maxLength}
              onChange={set('maxLength')}
            />
            <Check
              label="Include web links"
              hint="ignored for passage"
              value={form.includeWebLinks}
              onChange={set('includeWebLinks')}
            />
            <Check
              label="Include image links"
              hint="ignored for passage"
              value={form.includeImageLinks}
              onChange={set('includeImageLinks')}
            />
          </Section>
          <Section title="Crawling">
            <Select
              label="Live crawl"
              hint="fallback: crawl if not indexed (may return 202)"
              options={['none', 'fallback'] as const}
              value={form.liveCrawl}
              onChange={set('liveCrawl')}
            />
            <Check
              label="Render dynamic pages"
              hint="JavaScript rendering, only with fallback"
              value={form.renderDynamicPages}
              onChange={set('renderDynamicPages')}
            />
          </Section>
          <Locale language={form.language} region={form.region} onLanguage={set('language')} onRegion={set('region')} />
        </>
      }
    />
  )
}
