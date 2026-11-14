import { useEffect, useState } from 'react';
import PageTransition from '../../components/PageTransition.jsx';
import StickerCard from '../../components/StickerCard.jsx';
import SquishyButton from '../../components/SquishyButton.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import OneLiner from '../../components/OneLiner.jsx';
import { useToast } from '../../components/Toasts.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../lib/api.js';
import { copyText } from '../../lib/clipboard.js';
import { errorMessage } from '../../lib/errors.js';

export default function AdminOverview() {
  const { user, workspace, setWorkspace } = useAuth();
  const toast = useToast();
  const [members, setMembers] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .get('/api/team')
      .then((d) => alive && setMembers(d.members))
      .catch((err) => alive && (setMembers([]), toast.error("Couldn't load the team", errorMessage(err, 'calm'))));
    return () => {
      alive = false;
    };
  }, [toast]);

  const code = workspace?.inviteCode || '';
  const inviteLink = `${window.location.origin}/employee/signup?code=${code}`;
  const employees = (members || []).filter((m) => m.role === 'employee');

  async function copy(text, what) {
    (await copyText(text)) ? toast.success(`${what} copied`, 'Share it with your team.') : toast.error("Couldn't copy", 'Select it and copy by hand.');
  }

  async function regenerate() {
    setBusy(true);
    try {
      const r = await api.post('/api/workspace/invite/regenerate');
      setWorkspace({ ...workspace, inviteCode: r.inviteCode });
      toast.success('New invite code ready', 'The old one no longer works.');
    } catch (err) {
      toast.error("Couldn't regenerate", errorMessage(err, 'calm'));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <PageTransition>
      <div className="container page-body">
        <header className="page-head">
          <h1 className="display h2 page-title">Overview</h1>
          <p className="page-sub">
            Welcome, {user.name.split(' ')[0]}. <OneLiner kind="tagline" interval={9000} />
          </p>
        </header>

        <div className="dash-grid">
          <StickerCard color="yellow" tilt={-0.5} hover={false} halftone>
            <section className="pad" aria-labelledby="invite-h">
              <h2 id="invite-h" className="card-title">
                Invite code
              </h2>
              <p className="card-note">Share this with your team. They enter it on the “Join your team” page.</p>
              <div className="invite" aria-label={`Invite code ${code}`}>
                {code}
              </div>
              <div className="btn-row">
                <SquishyButton size="sm" variant="ghost" onClick={() => copy(code, 'Invite code')}>
                  Copy code
                </SquishyButton>
                <SquishyButton size="sm" variant="ghost" onClick={() => copy(inviteLink, 'Invite link')}>
                  Copy invite link
                </SquishyButton>
                {confirming ? (
                  <>
                    <SquishyButton size="sm" variant="pink" onClick={regenerate} disabled={busy} burst="ZAP!">
                      Yes, retire the old code
                    </SquishyButton>
                    <SquishyButton size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                      Cancel
                    </SquishyButton>
                  </>
                ) : (
                  <SquishyButton size="sm" variant="pink" onClick={() => setConfirming(true)}>
                    Regenerate
                  </SquishyButton>
                )}
              </div>
            </section>
          </StickerCard>

          <StickerCard color="paper" tilt={0.4} hover={false}>
            <section className="pad" aria-labelledby="team-h">
              <h2 id="team-h" className="card-title">
                Team <span className="chip">{members ? employees.length : '…'}</span>
              </h2>
              {members === null ? (
                <p className="card-note" role="status">
                  <OneLiner kind="loading" interval={1600} />
                </p>
              ) : employees.length === 0 ? (
                <EmptyState mood="shrug" kind="empty" title="Nobody yet" size={110} />
              ) : (
                <ul className="members">
                  {employees.map((m) => (
                    <li key={m.id}>
                      <span className="avatar" aria-hidden="true">
                        {m.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="members__who">
                        <strong>{m.name}</strong>
                        <span>{m.email}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </StickerCard>
        </div>

        <StickerCard color="cyan" tilt={-0.3} hover={false} className="soon">
          <p className="pad">
            <strong>Team scores and the live activity feed</strong> arrive in milestone 6. Until then, this is where invites live.
          </p>
        </StickerCard>
      </div>
    </PageTransition>
  );
}
