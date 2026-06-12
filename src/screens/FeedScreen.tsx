import { Avatar } from '../components/Avatar';
import { PostCard } from '../components/PostCard';
import { FILTER_TABS } from '../constants';
import { useApp } from '../context/AppContext';
import type { FilterTab } from '../types';

const TAB_LABELS: Record<FilterTab, string> = {
  all: 'all',
  food: 'food',
  trade: 'trade',
  hang: 'hang',
};

export function FeedScreen() {
  const {
    user,
    profile,
    myAura,
    filter,
    setFilterTab,
    getSortedPosts,
    getTagAff,
    vote,
    meetUp,
    openChatFromPost,
    sharePost,
    firebaseUid,
    openSheet,
    openSheetWith,
    showAura,
    goScreen,
    toastMsg,
    toastVisible,
  } = useApp();

  if (!user) return null;

  const sorted = getSortedPosts();
  const aff = getTagAff();
  const hasAff = Object.values(aff).some((v) => v > 0);

  return (
    <>
      <div className="hdr">
        <div className="logo">SALT 🧂</div>
        <div className="hdr-right">
          <div className="aura-pill" onClick={showAura} role="button" tabIndex={0}>
            <i className="ti ti-sparkles" style={{ fontSize: 13, color: '#3DA882' }} />
            <span className="aura-num">{myAura}</span>
          </div>
          <Avatar
            initials={user.ini}
            photoUrl={user.photoUrl}
            colorIndex={profile?.avatarIndex}
            size="sm"
            className="avi"
            onClick={() => goScreen('profile')}
          />
        </div>
      </div>
      <div className="school-bar">
        <div className="school-txt">
          <span className="live-dot" />
          <span>
            {user.name} · {user.city}
          </span>
        </div>
        <span className="expire-txt">posts die in 24h</span>
      </div>
      <div className="compose">
        <div className="compose-top">
          <Avatar
            initials={user.ini}
            photoUrl={user.photoUrl}
            colorIndex={profile?.avatarIndex}
            size="md"
            className="cavi"
          />
          <div className="cfake" onClick={openSheet} role="button" tabIndex={0}>
            what&apos;s the move tonight?
          </div>
        </div>
        <div className="cbtns">
          <button type="button" className="ctag" onClick={() => openSheetWith('food')}>
            food
          </button>
          <button type="button" className="ctag" onClick={() => openSheetWith('trade')}>
            trade
          </button>
          <button type="button" className="ctag" onClick={() => openSheetWith('hang')}>
            hang
          </button>
          <button type="button" className="cpost" onClick={openSheet}>
            POST
          </button>
        </div>
      </div>
      <div className="tabs" id="ftabs">
        {FILTER_TABS.map((f) => (
          <button
            key={f}
            type="button"
            className={`tab${filter === f ? ' on' : ''}`}
            onClick={() => setFilterTab(f)}
          >
            {TAB_LABELS[f]}
          </button>
        ))}
      </div>
      <div className={`toast${toastVisible ? ' show' : ''}`}>
        <i className="ti ti-sparkles" style={{ fontSize: 13, color: '#3DA882' }} />
        <span className="toast-msg">{toastMsg}</span>
      </div>
      <div className="scroll" id="feed">
        {!sorted.length ? (
          <div className="empty">
            <i className="ti ti-ghost" />
            <div className="etit">nothing here</div>
            be the first to post.
          </div>
        ) : (
          sorted.map((p, i) => (
            <PostCard
              key={p.id}
              post={p}
              schoolName={user.name}
              showRec={hasAff && i === 0 && filter === 'all'}
              currentUid={firebaseUid}
              onVote={vote}
              onMeetUp={meetUp}
              onOpenChat={openChatFromPost}
              onShare={sharePost}
            />
          ))
        )}
      </div>
    </>
  );
}
