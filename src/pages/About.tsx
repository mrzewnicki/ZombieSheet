import { useTranslation } from 'react-i18next'
import { useLayoutHeader } from '@/contexts/LayoutContext'
import { ICON_ATTRIBUTIONS, type LicenseEntry } from '@/config/licenses'

function LicenseList({ items }: { items: LicenseEntry[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.name} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink hover:text-blood-light transition-colors"
            >
              {item.name}
            </a>
          ) : (
            <span className="text-ink">{item.name}</span>
          )}
          <span className="text-xs font-mono text-ink-faint">{item.license}</span>
        </li>
      ))}
    </ul>
  )
}

export default function About() {
  const { t } = useTranslation()
  useLayoutHeader({ title: t('about.title') }, [t])

  return (
    <div className="max-w-2xl space-y-6">
      <section className="bg-surface border border-border rounded-lg p-5 space-y-3">
        <h1 className="font-heading text-2xl text-blood-light">{t('about.title')}</h1>
        <p className="text-sm text-ink-muted leading-relaxed">{t('about.description')}</p>
      </section>

      <section className="bg-surface border border-border rounded-lg p-5 space-y-3">
        <h2 className="font-heading text-sm text-blood-light tracking-widest uppercase">
          {t('about.licenses.iconsTitle')}
        </h2>
        <p className="text-xs text-ink-faint leading-relaxed">{t('about.licenses.iconsHint')}</p>
        <LicenseList items={ICON_ATTRIBUTIONS} />
      </section>
    </div>
  )
}
