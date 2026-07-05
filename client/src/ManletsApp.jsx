import { useEffect, useMemo, useState } from 'react';

const MANLET_IMAGES = [
  { src: '/manlets-main.png', alt: 'Main neon Manlets character on purple background' },
  { src: '/manlets-army.svg', alt: 'Crowd of Manlets characters holding shields' },
  { src: '/manlets-island.svg', alt: 'Glowing Manlets character on a purple island scene' },
  { src: '/manlets-glow.svg', alt: 'Close up glowing Manlets character on purple background' },
];

const MACHINE_STEPS = [
  {
    label: '01',
    title: 'Buy MANLETS',
    body: 'A wallet buys the original MANLETS token through the watched Pump.fun market.',
  },
  {
    label: '02',
    title: 'Listener catches it',
    body: 'A websocket/RPC subscription classifies the swap as a buy and pushes it into the queue.',
  },
  {
    label: '03',
    title: 'Factory clones',
    body: 'The backend mints a new MANLETS with matching name, symbol, image, links, and launch settings.',
  },
  {
    label: '04',
    title: 'Registry expands',
    body: 'Every spawned mint is indexed with the trigger signature, metadata URI, and explorer links.',
  },
];

const FEED_LINES = [
  '[boot] manlets-factory v1 warming up',
  '[rpc] subscribed to original MANLETS mint',
  '[queue] waiting for confirmed buy events',
  '[factory] metadata clone template locked',
  '[registry] spawned mint index ready',
  '[status] buy -> clone -> register -> repeat',
];

const FACTORY_SPECS = [
  ['trigger', 'confirmed MANLETS buy'],
  ['name', 'MANLETS'],
  ['symbol', 'MANLETS'],
  ['metadata', 'image + website + X + links'],
  ['launcher', 'server-held factory keypair'],
  ['registry', 'append-only spawned mint index'],
];

function ManletVisual({ image, size = 'large' }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={`manlets-css-avatar manlets-css-avatar-${size}`} aria-label={image.alt} role="img">
        <span className="manlets-css-face">
          <i />
          <i />
          <b />
        </span>
      </div>
    );
  }

  return <img src={image.src} alt={image.alt} onError={() => setFailed(true)} />;
}

export default function ManletsApp() {
  const [pulse, setPulse] = useState(0);
  const [copied, setCopied] = useState(208);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPulse((value) => (value + 1) % FEED_LINES.length);
      setCopied((value) => value + (Math.random() > 0.62 ? 1 : 0));
    }, 2600);

    return () => window.clearInterval(timer);
  }, []);

  const registryPreview = useMemo(() => (
    Array.from({ length: 8 }, (_, index) => ({
      id: String(copied - index).padStart(6, '0'),
      mint: index === 0 ? 'TBA' : `${Math.random().toString(36).slice(2, 6).toUpperCase()}...pump`,
      status: index === 0 ? 'next clone armed' : 'indexed',
    }))
  ), [copied]);

  return (
    <main className="manlets-page">
      <div className="manlets-bg" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <div className="manlets-marquee" aria-label="MANLETS protocol headline">
        <div>
          <span>buy manlets</span>
          <span>spawn manlets</span>
          <span>same token forever</span>
          <span>one mint becomes many</span>
          <span>buy manlets</span>
          <span>spawn manlets</span>
          <span>same token forever</span>
          <span>one mint becomes many</span>
        </div>
      </div>

      <header className="manlets-nav">
        <a className="manlets-brand" href="#top" aria-label="MANLETS home">
          <span className="manlets-brand-mark">M</span>
          <strong>MANLETS</strong>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#machine">Machine</a>
          <a href="#registry">Registry</a>
          <a href="#spec">Spec</a>
        </nav>
        <a className="manlets-nav-buy" href="https://pump.fun/" target="_blank" rel="noreferrer">
          pump.fun
        </a>
      </header>

      <section id="top" className="manlets-hero">
        <div className="manlets-hero-copy">
          <p className="manlets-kicker">Pump.fun clone protocol</p>
          <h1>
            Every buy makes another
            <span> MANLETS.</span>
          </h1>
          <p className="manlets-lede">
            MANLETS is a recursive Solana token concept: detect each confirmed buy, launch a fresh
            MANLETS token with matching metadata, and index the whole clone army in real time.
          </p>

          <div className="manlets-actions">
            <a href="https://pump.fun/" target="_blank" rel="noreferrer">Buy original</a>
            <a href="#machine">Watch the machine</a>
          </div>

          <div className="manlets-ca">
            <span>CA</span>
            <code>TBA - original mint connects here</code>
          </div>
        </div>

        <div className="manlets-hero-art">
          <div className="manlets-main-card">
            <ManletVisual image={MANLET_IMAGES[0]} />
            <div className="manlets-orbit-card">
              <strong>{String(copied).padStart(8, '0')}</strong>
              <span>copies minted</span>
            </div>
          </div>
          <div className="manlets-mini-grid">
            {MANLET_IMAGES.slice(1).map((image) => (
              <figure key={image.src}>
                <ManletVisual image={image} size="small" />
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="manlets-stats" aria-label="MANLETS live statistics">
        <article>
          <span>copies minted</span>
          <strong>{String(copied).padStart(8, '0')}</strong>
        </article>
        <article>
          <span>clone mode</span>
          <strong>buy-triggered</strong>
        </article>
        <article>
          <span>metadata</span>
          <strong>locked</strong>
        </article>
        <article>
          <span>network</span>
          <strong>Solana</strong>
        </article>
      </section>

      <section id="machine" className="manlets-machine">
        <div className="manlets-section-head">
          <p>the clone machine</p>
          <h2>Buy once. Spawn once. Repeat until the chart is all Manlets.</h2>
        </div>

        <div className="manlets-steps">
          {MACHINE_STEPS.map((step) => (
            <article key={step.label}>
              <span>{step.label}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="manlets-live-grid">
        <div className="manlets-terminal">
          <div className="manlets-terminal-top">
            <span />
            <span />
            <span />
            <strong>live clone feed</strong>
          </div>
          <div className="manlets-terminal-body">
            {FEED_LINES.map((line, index) => (
              <p className={index === pulse ? 'is-hot' : ''} key={line}>
                <span>{index === pulse ? '[live]' : '[sys]'}</span>
                {line}
              </p>
            ))}
            <p className="manlets-prompt">manlets@factory:~/spawn$</p>
          </div>
        </div>

        <div id="spec" className="manlets-spec">
          <div className="manlets-section-head">
            <p>factory spec</p>
            <h2>Same name. Same face. Same links. New mint.</h2>
          </div>
          <dl>
            {FACTORY_SPECS.map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section id="registry" className="manlets-registry">
        <div className="manlets-section-head">
          <p>spawn registry</p>
          <h2>The index of every MANLETS born from a buy.</h2>
        </div>
        <div className="manlets-registry-list">
          {registryPreview.map((item) => (
            <article key={item.id}>
              <span>#{item.id}</span>
              <strong>{item.mint}</strong>
              <em>{item.status}</em>
            </article>
          ))}
        </div>
      </section>

      <footer className="manlets-footer">
        <p>Not financial advice. Meme protocol page and implementation scaffold.</p>
        <div>
          <a href="https://pump.fun/" target="_blank" rel="noreferrer">pump.fun</a>
          <a href="https://x.com/" target="_blank" rel="noreferrer">X</a>
          <a href="#top">back to top</a>
        </div>
      </footer>
    </main>
  );
}
