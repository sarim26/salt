import { useState } from 'react';
import { useApp } from '../context/AppContext';

const VIBES = [
  'chill af',
  'legit trader',
  'on time',
  'great energy',
  'new friend',
  'solid human',
];

export function RateOverlay() {
  const {
    rateOpen,
    rateWho,
    rateDecay,
    ratePointsLabel,
    starV,
    setStarV,
    submitRate,
    closeRate,
  } = useApp();
  const [vibes, setVibes] = useState<Record<string, boolean>>({});

  const toggleVibe = (v: string) => {
    setVibes((prev) => ({ ...prev, [v]: !prev[v] }));
  };

  const handleClose = () => {
    setVibes({});
    closeRate();
  };

  const handleSubmit = () => {
    setVibes({});
    submitRate();
  };

  return (
    <div className={`rate-ov${rateOpen ? ' open' : ''}`} id="row">
      <div className="rbox">
        <div className="rlbl">meet &amp; eat</div>
        <div className="rtitle">RATE THEIR AURA</div>
        <div className="rsub">how was the vibe? your rating gives them aura.</div>
        <div className="rdecay">{rateDecay}</div>
        <div className="rwho">{rateWho}</div>
        <div className="stars">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={`star${starV >= n ? ' lit' : ''}`}
              onClick={() => setStarV(n)}
            >
              ★
            </button>
          ))}
        </div>
        <div className="spts">{ratePointsLabel}</div>
        <div className="vibes">
          {VIBES.map((v) => (
            <button
              key={v}
              type="button"
              className={`vibe${vibes[v] ? ' on' : ''}`}
              onClick={() => toggleVibe(v)}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="vnote">tags are qualitative only — no aura impact</div>
        <div className="rrew">you always get +15 aura for reviewing</div>
        <button type="button" className="rgo" onClick={handleSubmit}>
          GIVE AURA →
        </button>
        <button type="button" className="rskip" onClick={handleClose}>
          skip for now
        </button>
      </div>
    </div>
  );
}
