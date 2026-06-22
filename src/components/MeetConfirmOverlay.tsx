import { useApp } from '../context/AppContext';

export function MeetConfirmOverlay() {
  const { meetConfirmOpen, meetConfirmWho, cancelMeetConfirm, confirmSendMeetRequest, meetConfirmSending } =
    useApp();

  return (
    <div className={`rate-ov${meetConfirmOpen ? ' open' : ''}`} id="meet-confirm">
      <div className="rbox">
        <div className="rlbl">meet &amp; eat</div>
        <div className="rtitle">SEND MEET REQUEST?</div>
        <div className="rsub">we&apos;ll message {meetConfirmWho} for you</div>
        <div className="rwho">{meetConfirmWho}</div>
        <p className="meet-confirm-note">
          they&apos;ll get a chat message and can confirm once you meet in person.
        </p>
        <button
          type="button"
          className="rgo"
          onClick={confirmSendMeetRequest}
          disabled={meetConfirmSending}
        >
          {meetConfirmSending ? 'SENDING...' : 'SEND REQUEST →'}
        </button>
        <button
          type="button"
          className="meet-confirm-cancel"
          onClick={cancelMeetConfirm}
          disabled={meetConfirmSending}
        >
          cancel
        </button>
      </div>
    </div>
  );
}
