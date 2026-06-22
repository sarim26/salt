import { useRef, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { Logo } from '../components/Logo';
import { MyPostHistoryCard } from '../components/MyPostHistoryCard';
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
    myPostHistory,
    earnedBdg,
    aHist,
    goScreen,
    doLogout,
    showAura,
    uploadProfilePhoto,
    openSheet,
    deletePost,
  } = useApp();

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  if (!user) return null;

  const badges = BDG_DEF.filter((b) => earnedBdg.has(b.n));
  const livePosts = myPostHistory.filter((p) => !p.expired && p.mins > 0);

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
        <Logo onClick={() => goScreen('feed')} />
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
          <div className="stitle">my posts</div>
          {myPostHistory.length ? (
            <>
              {livePosts.length > 0 && (
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--teal)',
                    fontFamily: 'var(--fh)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    marginBottom: 8,
                  }}
                >
                  {livePosts.length} live now
                </div>
              )}
              {myPostHistory.map((p) => (
                <MyPostHistoryCard key={p.id} post={p} onDelete={deletePost} />
              ))}
            </>
          ) : (
            <div className="hist-empty">
              no posts yet — share what&apos;s the move on campus.
              <button type="button" className="hist-new" onClick={openSheet}>
                create post
              </button>
            </div>
          )}
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
        <div className="danger-zone">
          <div className="danger-title">account</div>
          <DeleteAccountSection email={profile?.email || ''} />
        </div>
      </div>
    </>
  );
}

function DeleteAccountSection({ email }: { email: string }) {
  const { deleteAccount } = useApp();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setStep(0);
    setPassword('');
    setConfirmText('');
    setError('');
  };

  const handleDelete = async () => {
    setError('');
    if (confirmText.trim().toUpperCase() !== 'DELETE') {
      setError('type DELETE to confirm');
      return;
    }
    setBusy(true);
    try {
      await deleteAccount(password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'could not delete account');
    } finally {
      setBusy(false);
    }
  };

  if (step === 0) {
    return (
      <button type="button" className="danger-btn" onClick={() => setStep(1)}>
        delete account
      </button>
    );
  }

  if (step === 1) {
    return (
      <div className="danger-panel">
        <p className="danger-warn">
          This permanently deletes your SALT account, profile, posts, and aura data.{' '}
          <strong>This cannot be undone.</strong>
        </p>
        <div className="danger-actions">
          <button type="button" className="danger-cancel" onClick={reset}>
            cancel
          </button>
          <button type="button" className="danger-continue" onClick={() => setStep(2)}>
            continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="danger-panel">
      <p className="danger-warn">
        Final step: enter your password and type <strong>DELETE</strong> to remove{' '}
        {email || 'your account'} from Firebase.
      </p>
      <div className="danger-lbl">password</div>
      <input
        className="danger-inp"
        type="password"
        placeholder="your password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
      />
      <div className="danger-lbl">type DELETE</div>
      <input
        className="danger-inp"
        type="text"
        placeholder="DELETE"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        autoComplete="off"
      />
      <div className="danger-err">{error}</div>
      <div className="danger-actions" style={{ marginBottom: 0 }}>
        <button type="button" className="danger-cancel" onClick={() => setStep(1)} disabled={busy}>
          back
        </button>
        <button
          type="button"
          className="danger-final"
          style={{ flex: 1 }}
          disabled={busy || !password || confirmText.trim().toUpperCase() !== 'DELETE'}
          onClick={handleDelete}
        >
          {busy ? 'deleting…' : 'delete forever'}
        </button>
      </div>
    </div>
  );
}
