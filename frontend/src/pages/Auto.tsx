import { autoMutation } from '@/client/@tanstack/react-query.gen'
import type { AutoIn } from '@/client/types.gen'
import { Explorer } from '@/components/Explorer'
import { Chips, Locale, Num, OptText, Section, Select, Text } from '@/components/fields'
import { AutoResults } from '@/components/results'
import { useForm, useWebIQCall } from '@/lib/calls'

export function Auto() {
  const [form, set] = useForm<AutoIn>({
    query: '',
    mode: 'fast',
    maxResponseLength: 30000,
    language: 'en',
    region: 'US',
  })
  const call = useWebIQCall(autoMutation())
  return (
    <Explorer
      title="Auto (beta)"
      endpoint="auto"
      docs="https://learn.microsoft.com/web-iq/reference/auto"
      intro={
        <>
          Typed evidence (text, media, weather, time zone) with citations, chosen by Web IQ. Only enabled for an AppID
          on request: without that, it answers 403.
        </>
      }
      body={form}
      canRun={!!form.query.trim()}
      onRun={() => call.mutate({ body: form })}
      state={call}
      results={AutoResults}
      form={
        <>
          <Text label="Query" multiline value={form.query} onChange={set('query')} placeholder="weather in Ghent" />
          <Select
            label="Mode"
            hint="fast or comprehensive"
            options={['fast', 'advanced'] as const}
            value={form.mode}
            onChange={set('mode')}
          />
          <Num
            label="Max response length"
            hint="1,500–500,000"
            min={1500}
            max={500000}
            value={form.maxResponseLength}
            onChange={set('maxResponseLength')}
          />
          <Chips
            label="Response filter (none = all)"
            options={['web', 'news', 'images', 'videos', 'weather', 'timezone'] as const}
            value={form.responseFilter}
            onChange={set('responseFilter')}
          />
          <Section title="Locale">
            <Locale
              language={form.language}
              region={form.region}
              onLanguage={set('language')}
              onRegion={set('region')}
            />
            <OptText
              label="Location"
              placeholder="lat:51.05;long:3.72"
              value={form.location}
              onChange={set('location')}
            />
          </Section>
        </>
      }
    />
  )
}
