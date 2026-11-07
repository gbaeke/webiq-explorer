import { searchImagesMutation } from '@/client/@tanstack/react-query.gen'
import type { ImageSearchIn } from '@/client/types.gen'
import { Explorer } from '@/components/Explorer'
import { Check, Locale, Num, Section, Select, Text } from '@/components/fields'
import { ImageResults } from '@/components/results'
import { useForm, useWebIQCall } from '@/lib/calls'

export function Images() {
  const [form, set] = useForm<ImageSearchIn>({
    query: '',
    maxResults: 30,
    language: 'en',
    region: 'US',
    watermarkFree: false,
    safeSearch: 'strict',
  })
  const call = useWebIQCall(searchImagesMutation())
  return (
    <Explorer
      title="Image search"
      endpoint="search/images"
      docs="https://learn.microsoft.com/web-iq/reference/image-search"
      intro="Images with captions, sizes and host pages. The terms of use allow only metadata and alt text for grounding."
      body={form}
      canRun={!!form.query.trim()}
      onRun={() => call.mutate({ body: form })}
      state={call}
      results={ImageResults}
      form={
        <>
          <Text label="Query" value={form.query} onChange={set('query')} placeholder="Brussels Atomium" />
          <Num label="Max results" min={1} max={30} value={form.maxResults} onChange={set('maxResults')} />
          <Locale language={form.language} region={form.region} onLanguage={set('language')} onRegion={set('region')} />
          <Section title="Filters">
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Aspect ratio"
                optional
                options={['square', 'wide', 'tall'] as const}
                value={form.aspectRatio}
                onChange={set('aspectRatio')}
              />
              <Select
                label="Color"
                optional
                options={['colorOnly', 'monochrome'] as const}
                value={form.color}
                onChange={set('color')}
              />
            </div>
            <Select
              label="Size"
              optional
              options={['small', 'medium', 'large', 'extraLarge'] as const}
              value={form.imageSize}
              onChange={set('imageSize')}
            />
            <div className="grid grid-cols-2 gap-3">
              <Num label="Min width" hint="px" min={1} value={form.minWidth} onChange={set('minWidth')} />
              <Num label="Max width" hint="px" min={1} value={form.maxWidth} onChange={set('maxWidth')} />
              <Num label="Min height" hint="px" min={1} value={form.minHeight} onChange={set('minHeight')} />
              <Num label="Max height" hint="px" min={1} value={form.maxHeight} onChange={set('maxHeight')} />
            </div>
            <Check label="Watermark-free only" value={form.watermarkFree} onChange={set('watermarkFree')} />
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
