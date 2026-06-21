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
  const { rateOpen, rateWho, starV, setStarV, submitRate } = useApp();
  const [vibes, setVibes] = useState<Record<string, boolean>>({});

  const toggleVibe = (v: string) => {
    setVibes((prev) => ({ ...prev, [v]: !prev[v] }));
  };

  const handleSubmit = () => {
    setVibes({});
    submitRate();
  };

  return (
    <div className={`rate-ov${rateOpen ? ' open' : ''}`} id="row">
      <div className="rbox">
        <div className="rlbl">meet &amp; eat</div>
        <div className="rtitle">RATE THE MEETUP</div>
        <div className="rsub">required — how was the vibe?</div>
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
        <div className="vnote">tags are optional — vibe check only</div>
        <button
          type="button"
          className="rgo"
          onClick={handleSubmit}
          disabled={starV < 1}
        >
          SUBMIT RATING →
        </button>
      </div>
    </div>
  );
}
