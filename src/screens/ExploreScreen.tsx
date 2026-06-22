import { LeaderboardCard } from '../components/LeaderboardCard';
import { Logo } from '../components/Logo';
import { PostCard } from '../components/PostCard';
import { useApp } from '../context/AppContext';
function SectionDivider({ label }: { label: string }) {
  return (
    <div className="div" style={{ marginTop: label === 'students' ? 14 : 8 }}>
      <div className="divl" />
      <div className="divt">{label}</div>
      <div className="divl" />
    </div>
  );
}

export function ExploreScreen() {
  const {
    user,
    myAura,
    lb,
    posts,
    searchQuery,
    doSearch,
    doTabAndGo,
    showAura,
    vote,
    meetUp,
    rateMeetUp,
    openChatFromPost,
    sharePost,
    firebaseUid,
  } = useApp();

  if (!user) return null;

  const q = searchQuery.toLowerCase().trim();
  const sortedLb = [...lb].sort((a, b) => b.aura - a.aura);

  let content: React.ReactNode;

  if (q) {
    const ur = lb.filter((u) => u.n.toLowerCase().includes(q));
    const pr = posts.filter(
      (p) =>
        p.body.toLowerCase().includes(q) || p.tags.some((t) => t.includes(q))
    );
    if (!ur.length && !pr.length) {
      content = (
        <div className="empty" style={{ paddingTop: 32 }}>
          <div className="etit">no results</div>
          try a different search
        </div>
      );
    } else {
      content = (
        <>
          {ur.length > 0 && (
            <>
              <SectionDivider label="students" />
              {ur.map((u) => (
                <LeaderboardCard
                  key={u.i + u.n}
                  user={u}
                  schoolName={user.name}
                  style={{ margin: '0 14px 8px' }}
                />
              ))}
            </>
          )}
          {pr.length > 0 && (
            <>
              <SectionDivider label="posts" />
              {pr.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  schoolName={user.name}
                  compact
                  currentUid={firebaseUid}
                  onVote={vote}
                  onMeetUp={meetUp}
                  onRateMeetUp={rateMeetUp}
                  onOpenChat={openChatFromPost}
                  onShare={sharePost}
                />
              ))}
            </>
          )}
        </>
      );
    }
  } else {
    content = sortedLb.map((u, i) => (
      <LeaderboardCard key={u.i + u.n} user={u} rank={i + 1} schoolName={user.name} />
    ));
  }

  return (
    <>
      <div className="hdr">
        <Logo />
        <div className="hdr-right">
          <div className="aura-pill" onClick={showAura} role="button" tabIndex={0}>
            <i className="ti ti-sparkles" style={{ fontSize: 13, color: '#3DA882' }} />
            <span className="aura-num">{myAura}</span>
          </div>
        </div>
      </div>
      <div className="search-wrap">
        <div className="swi">
          <i className="ti ti-search sico" />
          <input
            className="sinp"
            placeholder="search students, posts, tags..."
            value={searchQuery}
            onChange={(e) => doSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="scroll" id="explore-content">
        <div className="esec">
          {!q && (
            <>
              <div className="etitle">trending tags</div>
              <div className="etags">
                <span className="etag" onClick={() => doTabAndGo('food')} role="button" tabIndex={0}>
                  food
                </span>
                <span className="etag" onClick={() => doTabAndGo('trade')} role="button" tabIndex={0}>
                  trade
                </span>
                <span className="etag" onClick={() => doTabAndGo('hang')} role="button" tabIndex={0}>
                  hang
                </span>
                <span className="etag">late night</span>
                <span className="etag">swipes</span>
                <span className="etag">commons</span>
              </div>
              <div className="etitle">top aura on campus</div>
            </>
          )}
          <div id="lb">{content}</div>
        </div>
      </div>
    </>
  );
}
