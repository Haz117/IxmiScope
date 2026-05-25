import { useEffect } from 'react'
import './AboutModal.css'

/* ── SVG icons (inline, no external deps) ── */
function IconCode() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  )
}

function IconGithub() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483
        0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466
        -.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832
        .092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688
        -.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1
        2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595
        1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012
        2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  )
}

function IconMail() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <polyline points="2,4 12,13 22,4" />
    </svg>
  )
}

function IconExternal() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  )
}

/* ══════════════════════════════════════════════════
   Card 1 — Hazel Jared Almaraz (terminal aesthetic)
══════════════════════════════════════════════════ */
function TerminalCard() {
  return (
    <article className="about-card-terminal" aria-label="Perfil de Hazel Jared Almaraz">
      {/* Title bar */}
      <div className="term-titlebar">
        <div className="term-dots" aria-hidden="true">
          <span className="term-dot term-dot-r" />
          <span className="term-dot term-dot-y" />
          <span className="term-dot term-dot-g" />
        </div>
        <span className="term-path">~/sistemas-municipales</span>
        <span className="term-branch">[main]</span>
      </div>

      {/* Body */}
      <div className="term-body">

        {/* cat /etc/perfil */}
        <div className="term-block">
          <span className="term-prompt">$ cat /etc/perfil</span>
          <span className="term-name-line">Hazel Jared Almaraz</span>
          <span className="term-output-line">Software Engineer · UAEH 2025</span>
          <span className="term-output-dim">Operador de Sistemas · Presidencia Municipal Ixmiquilpan</span>
        </div>

        {/* uptime */}
        <div className="term-block">
          <span className="term-prompt">$ uptime</span>
          <span className="term-uptime-val">2+ años en producción real · gobierno municipal</span>
        </div>

        {/* awards */}
        <div className="term-block">
          <span className="term-prompt">$ cat awards.json</span>
          <div className="term-awards">
            <span className="term-award-pill">🏆 Premio OX 2026</span>
            <span className="term-award-pill">☁️ AWS CLF-C02</span>
            <span className="term-award-pill">📄 ANIEI 2024</span>
          </div>
        </div>

        {/* projects */}
        <div className="term-block">
          <span className="term-prompt">$ ls ~/projects/featured/</span>
          <div className="term-projects">
            {['Catdata', 'Lumixmi', 'GobIxmi', 'TodoApp'].map(p => (
              <span key={p} className="term-proj-pill">{p}</span>
            ))}
          </div>
        </div>

        {/* stack */}
        <div className="term-block">
          <span className="term-prompt">$ cat package.json | jq .stack</span>
          <div className="term-stack">
            {['React 19', 'Next.js', 'Supabase', 'Firebase', 'React Native', 'Python'].map(s => (
              <span key={s} className="term-stack-pill">{s}</span>
            ))}
          </div>
        </div>

        <hr className="term-divider" />

        {/* links */}
        <div className="term-links">
          <a
            className="term-link-btn term-link-btn-gh"
            href="https://github.com/Haz117"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Perfil de GitHub de Hazel"
          >
            <IconGithub /> GitHub
          </a>
          <a
            className="term-link-btn term-link-btn-mail"
            href="mailto:hazelalmaraz91@gmail.com"
            aria-label="Enviar correo a Hazel"
          >
            <IconMail /> Email
          </a>
        </div>

        {/* status */}
        <div className="term-block">
          <span className="term-prompt">$ echo $STATUS</span>
          <span className="term-status-line">Disponible · hazelalmaraz91@gmail.com</span>
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
    { icon: '⚡', text: 'UI rápida' },
    { icon: '🧱', text: 'Arquitectura frontend' },
    { icon: '🔒', text: 'Buenas prácticas' },
    { icon: '🚀', text: 'Orientado a producto' },
  ]

  return (
    <article className="about-card-modern" aria-label="Perfil de Reyirel Luis">
      <div className="mod-header-strip" aria-hidden="true" />

      <div className="mod-body">

        {/* Avatar + identity */}
        <div className="mod-avatar-row">
          <div className="mod-avatar" aria-hidden="true">RL</div>
          <div className="mod-identity">
            <span className="mod-name">Reyirel (Luis)</span>
            <span className="mod-title">Frontend &amp; Full Stack Developer</span>
          </div>
        </div>

        {/* Badges */}
        <div className="mod-badges" aria-label="Tecnologías principales">
          {['React', 'Next.js', 'TypeScript'].map(b => (
            <span key={b} className="mod-badge">{b}</span>
          ))}
        </div>

        {/* Description */}
        <p className="mod-desc">
          Aplicaciones web escalables centradas en el usuario. CRM, LMS, dashboards
          administrativos y sitios institucionales.
        </p>

        {/* Stack */}
        <div className="mod-stack" aria-label="Stack tecnológico">
          {stack.map(s => (
            <span key={s} className="mod-stack-pill">{s}</span>
          ))}
        </div>

        {/* What I bring */}
        <div className="mod-strengths" aria-label="Fortalezas">
          {strengths.map(({ icon, text }) => (
            <div key={text} className="mod-strength-item">
              <span className="mod-strength-icon" aria-hidden="true">{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>

        <hr className="mod-divider" />

        {/* Links */}
        <div className="mod-links">
          <a
            className="mod-link-primary"
            href="https://codefolio-luis.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Portfolio de Reyirel Luis (abre en nueva pestaña)"
          >
            Portfolio <IconExternal />
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
  /* Close on Escape */
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  /* Close on overlay click */
  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="about-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Equipo de Desarrollo"
      onClick={handleOverlayClick}
    >
      <div className="about-panel">
        {/* Header */}
        <header className="about-header">
          <div className="about-header-left">
            <div className="about-header-icon" aria-hidden="true">
              <IconCode />
            </div>
            <h2 className="about-title">Equipo de Desarrollo</h2>
          </div>
          <button
            className="about-close-btn"
            onClick={onClose}
            aria-label="Cerrar modal"
            type="button"
          >
            ✕
          </button>
        </header>

        {/* Cards grid */}
        <div className="about-body">
          <TerminalCard />
          <ModernCard />
        </div>
      </div>
    </div>
  )
}
