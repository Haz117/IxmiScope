import { useEffect } from 'react'
import './AboutModal.css'

/* ── Icons ── */
const svg = (d, extra = {}) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" {...extra}>
    {d}
  </svg>
)
const IconCode     = () => svg(<><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></>, {width:16,height:16})
const IconClose    = () => svg(<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>)
const IconExternal = () => svg(<><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></>, {width:12,height:12})
const IconGithub   = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
  </svg>
)
const IconMail     = () => svg(<><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/></>, {width:13,height:13})
const IconStar     = () => svg(<><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></>, {width:13,height:13})

/* ══════════════════════════════════════════════════
   Hero banner
══════════════════════════════════════════════════ */
function AboutHero() {
  return (
    <div className="about-hero">
      <div className="about-hero-bg" aria-hidden="true" />
      <div className="about-hero-content">
        <div className="about-hero-label"><IconCode /> Desarrollado por</div>
        <div className="about-hero-devs">
          <div className="about-hero-dev">
            <div className="about-hero-avatar" style={{ '--av-a': '#4338ca', '--av-b': '#818cf8', '--av-glow': 'rgba(99,102,241,.5)' }}>HJA</div>
            <div className="about-hero-dev-info">
              <span className="about-hero-dev-name">Hazel Jared Almaraz</span>
              <span className="about-hero-dev-role"><IconStar /> Autor Principal · Lead Developer</span>
            </div>
          </div>
          <div className="about-hero-sep" aria-hidden="true">&amp;</div>
          <div className="about-hero-dev">
            <div className="about-hero-avatar" style={{ '--av-a': '#1d4ed8', '--av-b': '#60a5fa', '--av-glow': 'rgba(59,130,246,.45)' }}>RL</div>
            <div className="about-hero-dev-info">
              <span className="about-hero-dev-name">Reyirel (Luis)</span>
              <span className="about-hero-dev-role">Co-desarrollador · Frontend</span>
            </div>
          </div>
        </div>
        <div className="about-hero-meta">
          <span className="about-hero-chip">Primer commit: 28 Abr 2026</span>
          <span className="about-hero-chip">React 19 + Supabase</span>
          <span className="about-hero-chip">PWA · Offline-first</span>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════
   DevCard — componente unificado para ambos perfiles
══════════════════════════════════════════════════ */
function DevCard({ initials, name, role, badge, badgeLabel, bio, stack, highlights, links, accentA, accentB, accentGlow, accentText }) {
  const style = { '--ac-a': accentA, '--ac-b': accentB, '--ac-glow': accentGlow, '--ac-text': accentText }
  return (
    <article className="dev-card" style={style} aria-label={`Perfil de ${name}`}>
      {/* Accent strip */}
      <div className="dev-card-strip" aria-hidden="true" />

      <div className="dev-card-body">

        {/* Avatar + identidad */}
        <div className="dev-card-top">
          <div className="dev-card-avatar" aria-hidden="true">{initials}</div>
          <div className="dev-card-identity">
            <span className="dev-card-name">{name}</span>
            <span className="dev-card-role">{role}</span>
            <span className="dev-card-badge">{badgeLabel}</span>
          </div>
        </div>

        {/* Bio */}
        <p className="dev-card-bio">{bio}</p>

        {/* Highlights (logros / fortalezas) */}
        {highlights && (
          <div className="dev-card-highlights">
            {highlights.map(h => (
              <span key={h} className="dev-card-hl">{h}</span>
            ))}
          </div>
        )}

        {/* Stack */}
        <div className="dev-card-stack">
          {stack.map(s => <span key={s} className="dev-card-pill">{s}</span>)}
        </div>

        <div className="dev-card-divider" />

        {/* Links */}
        <div className="dev-card-links">
          {links.map(l => (
            <a key={l.label} className={`dev-card-link ${l.primary ? 'dev-card-link--primary' : 'dev-card-link--secondary'}`}
              href={l.href} target="_blank" rel="noopener noreferrer" aria-label={l.aria}>
              {l.icon} {l.label} {l.primary && <IconExternal />}
            </a>
          ))}
        </div>

      </div>
    </article>
  )
}

/* ── Datos de cada desarrollador ── */
const HAZEL = {
  initials: 'HJA',
  name: 'Hazel Jared Almaraz',
  role: 'Software Engineer · UAEH 2025',
  badgeLabel: '★ Autor Principal',
  bio: 'Operador de Sistemas en Presidencia Municipal de Ixmiquilpan. 2+ años entregando software en producción real para gobierno.',
  highlights: ['Premio OX 2026', 'AWS CLF-C02', 'ANIEI 2024'],
  stack: ['React 19', 'Next.js', 'Supabase', 'Firebase', 'React Native', 'Python'],
  links: [
    { label: 'Portfolio', href: 'https://git-two-xi.vercel.app/', primary: true,  aria: 'Portfolio de Hazel', icon: null },
    { label: 'GitHub',    href: 'https://github.com/Haz117',      primary: false, aria: 'GitHub de Hazel',    icon: <IconGithub /> },
    { label: 'Email',     href: 'mailto:hazelalmaraz91@gmail.com', primary: false, aria: 'Email de Hazel',     icon: <IconMail /> },
  ],
  accentA:    '#4338ca',
  accentB:    '#818cf8',
  accentGlow: 'rgba(99,102,241,.45)',
  accentText: '#a5b4fc',
}

const LUIS = {
  initials: 'RL',
  name: 'Reyirel (Luis)',
  role: 'Frontend & Full Stack Developer',
  badgeLabel: 'Co-desarrollador',
  bio: 'Aplicaciones web escalables centradas en el usuario. CRM, LMS, dashboards administrativos y sitios institucionales.',
  highlights: ['UI accesible', 'Arquitectura frontend', 'Buenas prácticas', 'Orientado a producto'],
  stack: ['React', 'Next.js', 'TypeScript', 'Node.js', 'Firebase', 'TailwindCSS', 'React Native', 'Flutter'],
  links: [
    { label: 'Portfolio', href: 'https://codefolio-luis.vercel.app/', primary: true,  aria: 'Portfolio de Luis', icon: null },
    { label: 'GitHub',    href: 'https://github.com/Reyirel',         primary: false, aria: 'GitHub de Luis',    icon: <IconGithub /> },
  ],
  accentA:    '#1d4ed8',
  accentB:    '#60a5fa',
  accentGlow: 'rgba(59,130,246,.4)',
  accentText: '#93c5fd',
}

/* ══════════════════════════════════════════════════
   AboutModal
══════════════════════════════════════════════════ */
export default function AboutModal({ onClose }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="about-overlay" role="dialog" aria-modal="true"
      aria-label="Equipo de Desarrollo"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="about-panel">

        <header className="about-header">
          <div className="about-header-left">
            <div className="about-header-icon" aria-hidden="true"><IconCode /></div>
            <h2 className="about-title">Equipo de Desarrollo</h2>
          </div>
          <button className="about-close-btn" onClick={onClose} aria-label="Cerrar" type="button">
            <IconClose />
          </button>
        </header>

        <AboutHero />

        <div className="about-body">
          <DevCard {...HAZEL} />
          <DevCard {...LUIS} />
        </div>

      </div>
    </div>
  )
}
