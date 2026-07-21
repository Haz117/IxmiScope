import { useEffect } from 'react'
import './AboutModal.css'

/* ── SVG icons ── */
const svg = (d, extra = {}) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" {...extra}>
    {d}
  </svg>
)

const IconCode      = () => svg(<><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></>, {width:16,height:16})
const IconClose     = () => svg(<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>)
const IconExternal  = () => svg(<><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></>, {width:12,height:12})
const IconGithub    = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
  </svg>
)
const IconMail      = () => svg(<><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/></>, {width:13,height:13})
const IconTrophy    = () => svg(<><path d="M6 9H4a2 2 0 0 1-2-2V5h4"/><path d="M18 9h2a2 2 0 0 0 2-2V5h-4"/><path d="M12 17v4"/><path d="M8 21h8"/><path d="M6 5h12v6a6 6 0 0 1-12 0V5Z"/></>)
const IconCloud     = () => svg(<><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10Z"/></>)
const IconFile      = () => svg(<><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></>)
const IconZap       = () => svg(<><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>)
const IconLayers    = () => svg(<><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></>)
const IconLock      = () => svg(<><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>)
const IconRocket    = () => svg(<><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></>)
const IconStar      = () => svg(<><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></>, {width:13,height:13})

/* ══════════════════════════════════════════════════
   Hero banner — los dos desarrolladores destacados
══════════════════════════════════════════════════ */
function AboutHero() {
  return (
    <div className="about-hero">
      <div className="about-hero-bg" aria-hidden="true" />
      <div className="about-hero-content">
        <div className="about-hero-label">
          <IconCode /> Desarrollado por
        </div>
        <div className="about-hero-devs">
          <div className="about-hero-dev">
            <div className="about-hero-avatar about-hero-avatar--main">HJA</div>
            <div className="about-hero-dev-info">
              <span className="about-hero-dev-name">Hazel Jared Almaraz</span>
              <span className="about-hero-dev-role">
                <IconStar /> Autor Principal · Lead Developer
              </span>
            </div>
          </div>
          <div className="about-hero-sep" aria-hidden="true">&</div>
          <div className="about-hero-dev">
            <div className="about-hero-avatar about-hero-avatar--sec">RL</div>
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
   Card 1 — Hazel Jared Almaraz (terminal aesthetic)
══════════════════════════════════════════════════ */
function TerminalCard() {
  return (
    <article className="about-card-terminal" aria-label="Perfil de Hazel Jared Almaraz">
      <div className="about-author-badge">
        <IconStar /> Autor Principal
      </div>

      {/* Title bar */}
      <div className="term-titlebar">
        <div className="term-dots" aria-hidden="true">
          <span className="term-dot term-dot-r" />
          <span className="term-dot term-dot-y" />
          <span className="term-dot term-dot-g" />
        </div>
        <span className="term-path">~/sistemas-municipales/IxmiData</span>
        <span className="term-branch">[main]</span>
      </div>

      {/* Body */}
      <div className="term-body">

        <div className="term-block">
          <span className="term-prompt">$ cat /etc/perfil</span>
          <span className="term-name-line">Hazel Jared Almaraz</span>
          <span className="term-output-line">Software Engineer · UAEH 2025</span>
          <span className="term-output-dim">Operador de Sistemas · Presidencia Municipal Ixmiquilpan</span>
        </div>

        <div className="term-block">
          <span className="term-prompt">$ uptime</span>
          <span className="term-uptime-val">2+ años en producción real · gobierno municipal</span>
        </div>

        <div className="term-block">
          <span className="term-prompt">$ cat awards.json</span>
          <div className="term-awards">
            <span className="term-award-pill"><IconTrophy /> Premio OX 2026</span>
            <span className="term-award-pill"><IconCloud /> AWS CLF-C02</span>
            <span className="term-award-pill"><IconFile /> ANIEI 2024</span>
          </div>
        </div>

        <div className="term-block">
          <span className="term-prompt">$ cat package.json | jq .stack</span>
          <div className="term-stack">
            {['React 19', 'Next.js', 'Supabase', 'Firebase', 'React Native', 'Python'].map(s => (
              <span key={s} className="term-stack-pill">{s}</span>
            ))}
          </div>
        </div>

        <hr className="term-divider" />

        <div className="term-links">
          <a className="term-link-btn term-link-btn-port"
            href="https://git-two-xi.vercel.app/" target="_blank" rel="noopener noreferrer"
            aria-label="Portfolio de Hazel">
            <IconExternal /> Portfolio
          </a>
          <a className="term-link-btn term-link-btn-gh"
            href="https://github.com/Haz117" target="_blank" rel="noopener noreferrer"
            aria-label="GitHub de Hazel">
            <IconGithub /> GitHub
          </a>
          <a className="term-link-btn term-link-btn-mail"
            href="mailto:hazelalmaraz91@gmail.com"
            aria-label="Email de Hazel">
            <IconMail /> Email
          </a>
        </div>

        <div className="term-block">
          <span className="term-prompt">$ echo $STATUS</span>
          <span className="term-status-line">● Disponible · hazelalmaraz91@gmail.com</span>
        </div>

      </div>
    </article>
  )
}

/* ══════════════════════════════════════════════════
   Card 2 — Reyirel Luis (clean modern card)
══════════════════════════════════════════════════ */
function ModernCard() {
  const stack = ['React', 'Next.js', 'TypeScript', 'Node.js', 'Firebase', 'TailwindCSS', 'React Native', 'Flutter']
  const strengths = [
    { Icon: IconZap,    text: 'UI rápida y accesible' },
    { Icon: IconLayers, text: 'Arquitectura frontend' },
    { Icon: IconLock,   text: 'Buenas prácticas' },
    { Icon: IconRocket, text: 'Orientado a producto' },
  ]

  return (
    <article className="about-card-modern" aria-label="Perfil de Reyirel Luis">
      <div className="mod-header-strip" aria-hidden="true" />

      <div className="mod-body">

        <div className="mod-avatar-row">
          <div className="mod-avatar" aria-hidden="true">RL</div>
          <div className="mod-identity">
            <span className="mod-name">Reyirel (Luis)</span>
            <span className="mod-title">Frontend &amp; Full Stack Developer</span>
            <span className="mod-collab-badge">Co-desarrollador</span>
          </div>
        </div>

        <div className="mod-badges" aria-label="Tecnologías principales">
          {['React', 'Next.js', 'TypeScript'].map(b => (
            <span key={b} className="mod-badge">{b}</span>
          ))}
        </div>

        <p className="mod-desc">
          Aplicaciones web escalables centradas en el usuario. CRM, LMS, dashboards
          administrativos y sitios institucionales.
        </p>

        <div className="mod-stack" aria-label="Stack tecnológico">
          {stack.map(s => (
            <span key={s} className="mod-stack-pill">{s}</span>
          ))}
        </div>

        <div className="mod-strengths" aria-label="Fortalezas">
          {strengths.map(({ Icon, text }) => (
            <div key={text} className="mod-strength-item">
              <span className="mod-strength-icon" aria-hidden="true"><Icon /></span>
              <span>{text}</span>
            </div>
          ))}
        </div>

        <hr className="mod-divider" />

        <div className="mod-links">
          <a className="mod-link-primary"
            href="https://codefolio-luis.vercel.app/" target="_blank" rel="noopener noreferrer"
            aria-label="Portfolio de Reyirel Luis">
            Portfolio <IconExternal />
          </a>
          <a className="mod-link-secondary"
            href="https://github.com/Reyirel" target="_blank" rel="noopener noreferrer"
            aria-label="GitHub de Reyirel Luis">
            <IconGithub /> GitHub
          </a>
        </div>

      </div>
    </article>
  )
}

/* ══════════════════════════════════════════════════
   AboutModal — main export
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
          <TerminalCard />
          <ModernCard />
        </div>

      </div>
    </div>
  )
}
