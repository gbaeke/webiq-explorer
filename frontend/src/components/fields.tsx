import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="flex items-baseline justify-between gap-2 text-xs font-medium">
        {label}
        {hint && <span className="font-normal text-fg-muted">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

type TextProps = { label: string; hint?: string; placeholder?: string; multiline?: boolean }

export function Text({
  label,
  hint,
  placeholder,
  multiline,
  value,
  onChange,
}: TextProps & { value: string | null | undefined; onChange: (v: string) => void }) {
  const props = { className: 'input', value: value ?? '', placeholder }
  return (
    <Field label={label} hint={hint}>
      {multiline ? (
        <textarea rows={3} {...props} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input {...props} onChange={(e) => onChange(e.target.value)} />
      )}
    </Field>
  )
}

/** Optional text: an empty box means "not sent". */
export function OptText({
  onChange,
  ...props
}: TextProps & { value: string | null | undefined; onChange: (v: string | undefined) => void }) {
  return <Text {...props} onChange={(v) => onChange(v.trim() ? v : undefined)} />
}

export function Num({
  label,
  hint,
  value,
  onChange,
  min,
  max,
}: {
  label: string
  hint?: string
  value: number | null | undefined
  onChange: (v: number | undefined) => void
  min?: number
  max?: number
}) {
  return (
    <Field label={label} hint={hint ?? (min !== undefined && max !== undefined ? `${min}–${max}` : undefined)}>
      <input
        type="number"
        className="input"
        value={value ?? ''}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      />
    </Field>
  )
}

export function Select<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
  optional,
}: {
  label: string
  hint?: string
  value: T | null | undefined
  options: readonly T[]
  onChange: (v: T | undefined) => void
  optional?: boolean
}) {
  return (
    <Field label={label} hint={hint}>
      <select
        className="input"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : (e.target.value as T))}
      >
        {optional && <option value="">(not set)</option>}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </Field>
  )
}

export function Check({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint?: string
  value: boolean | undefined
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-start gap-2 text-xs">
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-accent"
      />
      <span>
        <span className="font-medium">{label}</span>
        {hint && <span className="block text-fg-muted">{hint}</span>}
      </span>
    </label>
  )
}

/** A multi-select as toggle chips; nothing selected means "not sent". */
export function Chips<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T[] | null | undefined
  options: readonly T[]
  onChange: (v: T[] | undefined) => void
}) {
  const selected = value ?? []
  const toggle = (o: T) => {
    const next = selected.includes(o) ? selected.filter((s) => s !== o) : [...selected, o]
    onChange(next.length ? next : undefined)
  }
  return (
    <div className="space-y-1">
      <span className="text-xs font-medium">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            type="button"
            key={o}
            onClick={() => toggle(o)}
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-xs',
              selected.includes(o) ? 'border-accent bg-accent-soft text-accent' : 'border-border text-fg-muted',
            )}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Language and region, which every endpoint takes. */
export function Locale({
  language,
  region,
  onLanguage,
  onRegion,
}: {
  language: string | undefined
  region: string | undefined
  onLanguage: (v: string) => void
  onRegion: (v: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Text label="Language" hint="ISO 639-1" value={language} onChange={onLanguage} />
      <Text label="Region" hint="e.g. US, BE" value={region} onChange={onRegion} />
    </div>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-3 border-t border-border pt-3">
      <legend className="pr-2 text-[11px] font-semibold tracking-wide text-fg-muted uppercase">{title}</legend>
      {children}
    </fieldset>
  )
}
