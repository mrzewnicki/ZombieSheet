import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function AppFooter() {
  const { t } = useTranslation()

  return (
    <footer className="border-t border-border py-0.3 text-center">
      <Link
        to="/about"
        className="text-xs text-ink-faint hover:text-ink-muted transition-colors"
      >
        {t('footer.about')}
      </Link>
    </footer>
  )
}
