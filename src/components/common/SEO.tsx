import { useEffect } from 'react'

interface SEOProps {
  title: string
  description?: string
  noindex?: boolean
}

const APP_NAME = 'Kokoda Tracker'
const DEFAULT_DESCRIPTION =
  'Team training tracker for the Kokoda Challenge Brisbane — log sessions, record hikes and follow your AI training plan.'

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`,
  )
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(attr, key)
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', content)
}

function removeMeta(attr: 'name' | 'property', key: string) {
  document.head.querySelector(`meta[${attr}="${key}"]`)?.remove()
}

// Per-route document metadata (spec NFR: SEO component on every route).
// Client-side only — this app is a CSR PWA, no SSR.
export default function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  noindex = false,
}: SEOProps) {
  useEffect(() => {
    const fullTitle = title === APP_NAME ? title : `${title} — ${APP_NAME}`
    document.title = fullTitle
    setMeta('name', 'description', description)
    setMeta('property', 'og:title', fullTitle)
    setMeta('property', 'og:description', description)
    setMeta('property', 'og:type', 'website')
    setMeta('property', 'og:site_name', APP_NAME)
    if (noindex) {
      setMeta('name', 'robots', 'noindex')
    } else {
      removeMeta('name', 'robots')
    }
  }, [title, description, noindex])

  return null
}
