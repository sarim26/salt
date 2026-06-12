import { useRef, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { BDG_DEF } from '../constants';
import { useApp } from '../context/AppContext';
import { lvl } from '../utils/helpers';

export function ProfileScreen() {
  const {
    user,
    profile,
    firebaseUid,
    myAura,
    myPosts,
    myMeets,
    earnedBdg,
    aHist,
    goScreen,
    doLogout,
    showAura,
    uploadProfilePhoto,
  } = useApp();

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  if (!user) return null;

  const badges = BDG_DEF.filter((b) => earnedBdg.has(b.n));

  const handlePhotoPick = async (file: File | undefined) => {
    if (!file || !firebaseUid) return;
    setUploading(true);
    try {
      await uploadProfilePhoto(file);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <>
      <div className="hdr">
        <div className="logo" onClick={() => goScreen('feed')} role="button" tabIndex={0}>
          SALT 🧂
        </div>
        <div className="hdr-right">
          <button type="button" className="logout-btn" onClick={doLogout}>
            LOGOUT
          </button>
        </div>
      </div>
      <div className="scroll">
        <div className="profile-hero">
          <div className="pavi-wrap">
            <Avatar
              initials={user.ini}
              photoUrl={user.photoUrl}
              colorIndex={profile?.avatarIndex}
              size="lg"
              className="pavi-big"
            />
            <button
              type="button"
              className="dp-upload-btn"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || !firebaseUid}
              title="upload photo"
            >
              <i className="ti ti-camera" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => handlePhotoPick(e.target.files?.[0])}
            />
          </div>
          <div className="pinfo">
            <div className="pname-big">{user.full}</div>
            <div className="pschool">{user.school}</div>
            <div className="paura-big" onClick={showAura} role="button" tabIndex={0}>
              <i className="ti ti-sparkles" style={{ fontSize: 14, color: '#3DA882' }} />
              <span className="panum">{myAura}</span>
              <span className="palvl">{lvl(myAura)}</span>
            </div>
          </div>
        </div>
        <div className="pstats">
          <div className="sbox">
            <div className="snum">{myPosts}</div>
            <div className="slbl">posts</div>
          </div>
          <div className="sbox">
            <div className="snum">{myMeets}</div>
            <div className="slbl">meetups</div>
          </div>
          <div className="sbox">
            <div className="snum">{myAura}</div>
            <div className="slbl">aura pts</div>
          </div>
        </div>
        <div className="psec">
          <div className="stitle">badges</div>
          <div className="bdgs">
            {badges.length ? (
              badges.map((b) => (
                <span key={b.n} className={`bdg ${b.c}`}>
                  {b.n}
                </span>
              ))
            ) : (
              <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--fm)' }}>
                post and meet people to earn badges
              </span>
            )}
          </div>
        </div>
        <div className="psec">
          <div className="stitle">aura history</div>
          <div id="ahist">
            {aHist.length ? (
              aHist.map((h, i) => (
                <div key={i} className="hitem">
                  <div className="hico">
                    <i className={`ti ${h.ico}`} />
                  </div>
                  <div className="htxt">
                    <div className="hmain">{h.txt}</div>
                    <div className="hsub">{h.t}</div>
                  </div>
                  <div className="hpts">{h.pts}</div>
                </div>
              ))
            ) : (
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--muted)',
                  padding: '12px 0',
                  fontFamily: 'var(--fm)',
                }}
              >
                no activity yet — start meeting people
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
