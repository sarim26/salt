import { useApp } from '../context/AppContext';

export function PostSheet() {
  const {
    sheetOpen,
    postText,
    postTag,
    postLoc,
    postCapacity,
    setPostText,
    setPostTag,
    setPostLoc,
    setPostCapacity,
    closeSheet,
    doPost,
  } = useApp();

  return (
    <div
      className={`sheet-ov${sheetOpen ? ' open' : ''}`}
      id="sheet"
      onClick={(e) => {
        if ((e.target as HTMLElement).id === 'sheet') closeSheet('sheet');
      }}
    >
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="shdl" />
        <div className="shtitle">DROP A POST</div>
        <textarea
          className="shta"
          placeholder="heading to panda express — anyone trade swipes?"
          value={postText}
          onChange={(e) => setPostText(e.target.value)}
        />
        <div className="shrow">
          <select
            className="shsel"
            value={postTag}
            onChange={(e) => setPostTag(e.target.value)}
          >
            <option value="food">food</option>
            <option value="trade">trade</option>
            <option value="hang">hang</option>
          </select>
          <select
            className="shsel"
            value={postCapacity}
            onChange={(e) => setPostCapacity(Number(e.target.value))}
            title="how many people to meet"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'person' : 'people'}
              </option>
            ))}
          </select>
          <input
            className="shloc"
            placeholder="location (optional)"
            value={postLoc}
            onChange={(e) => setPostLoc(e.target.value)}
          />
        </div>
        <button type="button" className="shsub" onClick={doPost}>
          POST IT — GONE IN 24H
        </button>
        <p className="shnote">only visible to verified students at your campus</p>
      </div>
    </div>
  );
}
