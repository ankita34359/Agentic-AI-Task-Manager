import { useCallback, useEffect, useState } from 'react';
import PageTransition from '../../components/PageTransition.jsx';
import StickerCard from '../../components/StickerCard.jsx';
import SquishyButton from '../../components/SquishyButton.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import Field from '../../components/Field.jsx';
import OneLiner from '../../components/OneLiner.jsx';
import { useToast } from '../../components/Toasts.jsx';
import { api } from '../../lib/api.js';
import { copyText } from '../../lib/clipboard.js';
import { errorMessage } from '../../lib/errors.js';
import ConnectCards from './ConnectCards.jsx';

const DETAILED_SLACK = '*{{event}}* · {{owner}}\n{{title}} → {{status}} (impact {{impact}}/5, due {{deadline}})';

const ERROR_WORDS = { http: 'Server said no', redirect: 'Redirected (not followed)', network: "Couldn't connect", timeout: 'Timed out', blocked: 'Blocked address', no_url: 'URL was removed', bad_url: 'Bad URL', viasocket: 'viaSocket said no' };
const VIA_LABEL = { events: 'Events URL', sheets: 'Google Sheets', slack: 'Slack' };
const when = (iso) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

function CopyBlock({ label, text, copyAs = text, onCopy, id }) {
  return (
    <div className="copyblock">
      <div className="copyblock__head">
        <h3 id={id}>{label}</h3>
        <SquishyButton size="sm" variant="ghost" onClick={() => onCopy(copyAs, label)}>
          Copy
        </SquishyButton>
      </div>
      <pre className="copyblock__body" aria-labelledby={id} tabIndex={0}>
        {text}
      </pre>
    </div>
  );
}

export default function Integrations() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [url, setUrl] = useState('');
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const setConnect = useCallback((connect) => setData((d) => (d ? { ...d, connect } : d)), []);

  const load = useCallback(async () => {
    try {
      setData(await api.get('/api/integrations'));
    } catch (err) {
      toast.error("Couldn't load integrations", errorMessage(err, 'calm'));
    }
  }, [toast]);
  useEffect(() => {
    load();
  }, [load]);

  const copy = async (text, what) => ((await copyText(text)) ? toast.success(`${what} copied`, 'Paste it into your viaSocket flow.') : toast.error("Couldn't copy", 'Select it and copy by hand.'));

  async function save(e) {
    e.preventDefault();
    setBusy('save');
    setError('');
    try {
      setData(await api.put('/api/integrations/events', { url }));
      setUrl('');
      setEditing(false);
      setTestResult(null);
      toast.success('Events URL saved', 'It is hidden from now on. Send a test event to check it.');
    } catch (err) {
      setError(err.fields?.url || errorMessage(err, 'calm'));
    } finally {
      setBusy('');
    }
  }

  async function remove() {
    setBusy('remove');
    try {
      setData(await api.del('/api/integrations/events'));
      setConfirmRemove(false);
      setTestResult(null);
      toast.success('Events URL removed', 'No more events will be sent.');
    } catch (err) {
      toast.error("Couldn't remove it", errorMessage(err, 'calm'));
    } finally {
      setBusy('');
    }
  }

  async function sendTest() {
    setBusy('test');
    setTestResult(null);
    try {
      const r = await api.post('/api/integrations/events/test');
      setData({ events: r.events, activity: r.activity, reference: r.reference, adminName: r.adminName, connect: r.connect });
      setTestResult(r.result);
    } catch (err) {
      setTestResult({ ok: false, status: null, error: err.code === 'no_url' ? 'no_url' : 'network' });
    } finally {
      setBusy('');
    }
  }

  if (!data)
    return (
      <PageTransition>
        <div className="container page-body">
          <h1 className="display h2 page-title">Integrations</h1>
          <p className="loading-line" role="status">
            <OneLiner kind="loading" interval={1600} />
          </p>
        </div>
      </PageTransition>
    );

  const { events, activity, reference } = data;
  const showForm = !events.configured || editing;
  const sheetRow = reference.sheetHeader.join('\t');

  return (
    <PageTransition>
      <div className="container page-body">
        <header className="page-head">
          <h1 className="display h2 page-title">Integrations</h1>
          <p className="page-sub">Connect Google Sheets and Slack so every new outcome and every move lands there. The Events URL below still works too.</p>
        </header>

        <ConnectCards connect={data.connect} onState={setConnect} />

        <div className="int-grid">
          <StickerCard color="yellow" tilt={-0.3} hover={false} halftone>
            <section className="pad" aria-labelledby="events-h">
              <h2 id="events-h" className="card-title">
                Events flow <span className={`chip${events.configured ? ' chip--ok' : ''}`}>{events.configured ? 'Connected' : 'Not set'}</span>
              </h2>
              <p className="card-note">
                In viaSocket, create a flow that starts with a <b>Webhook</b> trigger, then paste its URL here. We POST one JSON object per event. The URL is a secret: once saved it is never shown again.
              </p>

              {events.configured && !editing && (
                <p className="masked" aria-label="Saved events URL (hidden)">
                  <code>{events.masked}</code>
                </p>
              )}

              {showForm && (
                <form className="form" onSubmit={save} noValidate>
                  <Field label="Events-flow URL" name="eventsUrl" type="url" inputMode="url" autoComplete="off" spellCheck={false} placeholder="https://flow.viasocket.com/webhook/…" value={url} onChange={(e) => setUrl(e.target.value)} error={error} hint="Must start with https://. Private and local addresses are refused." required />
                  <div className="btn-row">
                    <SquishyButton type="submit" disabled={busy === 'save' || !url.trim()}>
                      {busy === 'save' ? 'Checking…' : 'Save URL'}
                    </SquishyButton>
                    {editing && (
                      <SquishyButton variant="ghost" onClick={() => (setEditing(false), setUrl(''), setError(''))}>
                        Cancel
                      </SquishyButton>
                    )}
                  </div>
                </form>
              )}

              {events.configured && !editing && (
                <div className="btn-row">
                  <SquishyButton onClick={sendTest} disabled={busy === 'test'} burst={busy ? undefined : 'PING!'}>
                    {busy === 'test' ? 'Sending…' : 'Send test event'}
                  </SquishyButton>
                  <SquishyButton variant="ghost" onClick={() => setEditing(true)}>
                    Replace URL
                  </SquishyButton>
                  {confirmRemove ? (
                    <>
                      <SquishyButton variant="pink" onClick={remove} disabled={busy === 'remove'}>
                        Yes, remove it
                      </SquishyButton>
                      <SquishyButton variant="ghost" onClick={() => setConfirmRemove(false)}>
                        Keep
                      </SquishyButton>
                    </>
                  ) : (
                    <SquishyButton variant="ghost" onClick={() => setConfirmRemove(true)}>
                      Remove
                    </SquishyButton>
                  )}
                </div>
              )}

              {testResult && (
                <p className={`test-result test-result--${testResult.ok ? 'ok' : 'bad'}`} role="status">
                  {testResult.ok ? `✓ Delivered (HTTP ${testResult.status}). Check your sheet and Slack.` : `✗ ${testResult.status ? `HTTP ${testResult.status} · ` : ''}${ERROR_WORDS[testResult.error] || 'Failed'}. See the log below.`}
                </p>
              )}
              <p className="card-note card-note--small">Each event is tried up to {events.maxAttempts} times (about 3 s, then 15 s apart). Failed ones are logged; the URL never is.</p>
            </section>
          </StickerCard>

          <StickerCard color="paper" tilt={0.3} hover={false}>
            <section className="pad" aria-labelledby="soon-h">
              <h2 id="soon-h" className="card-title">
                Coming later
              </h2>
              <div className="soon-field">
                <Field label="AI flow URL" name="aiUrl" placeholder="Arrives in milestone 7" disabled hint="Proof validation, the Outcome Coach and the Weekly Review can use your own viaSocket AI flow." />
              </div>
              <div className="soon-field">
                <Field label="M91 phone alerts" name="m91" placeholder="Arrives in milestone 10" disabled hint="Escalated proofs ring your phone; Approve / Needs rework from the alert." />
              </div>
            </section>
          </StickerCard>
        </div>

        <StickerCard color="paper" tilt={-0.2} hover={false} className="int-card">
          <section className="pad" aria-labelledby="log-h">
            <div className="log-head">
              <h2 id="log-h" className="card-title">
                Activity log
              </h2>
              <SquishyButton size="sm" variant="ghost" onClick={load}>
                Refresh
              </SquishyButton>
            </div>
            {activity.length === 0 ? (
              <EmptyState mood="idle" kind="empty" title="No events yet" size={110}>
                <p className="empty__note">Save a URL and click “Send test event”, or let an employee plan an outcome.</p>
              </EmptyState>
            ) : (
              <div className="table-wrap" tabIndex={0} role="region" aria-label="Delivery attempts, newest first">
                <table className="log">
                  <thead>
                    <tr>
                      <th scope="col">When</th>
                      <th scope="col">Via</th>
                      <th scope="col">Event</th>
                      <th scope="col">Outcome</th>
                      <th scope="col">Attempt</th>
                      <th scope="col">Status</th>
                      <th scope="col">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.map((a) => (
                      <tr key={a.id} className={a.ok ? '' : 'log__bad'}>
                        <td>{when(a.at)}</td>
                      <td>{VIA_LABEL[a.via ?? 'events']}</td>
                        <td>
                          <code>{a.event}</code>
                        </td>
                        <td className="log__title">{a.title}</td>
                        <td>
                          {a.attempt}/{a.of}
                        </td>
                        <td>{a.status ?? '—'}</td>
                        <td className="log__result">{a.ok ? '✓ Delivered' : `✗ ${ERROR_WORDS[a.error] || 'Failed'}${a.detail ? `: ${a.detail}` : ''}${a.willRetry ? ' · will retry' : a.of > 1 ? ' · gave up' : ''}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </StickerCard>

        <StickerCard color="cyan" tilt={0.2} hover={false} className="int-card">
          <section className="pad" aria-labelledby="ref-h">
            <h2 id="ref-h" className="card-title">
              What we send
            </h2>
            <p className="card-note">A flat JSON object, so each viaSocket step can pick fields straight from the webhook.</p>
            <div className="table-wrap" tabIndex={0} role="region" aria-label="JSON fields">
              <table className="log fields">
                <thead>
                  <tr>
                    <th scope="col">Field</th>
                    <th scope="col">Example</th>
                    <th scope="col">Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  {reference.fields.map((f) => (
                    <tr key={f.name}>
                      <td>
                        <code>{f.name}</code>
                      </td>
                      <td className="log__title">
                        <code>{String(f.example)}</code>
                      </td>
                      <td>{f.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="copy-grid">
              <CopyBlock id="sheet-h" label="Google Sheet header row" text={reference.sheetHeader.join('  |  ')} copyAs={sheetRow} onCopy={copy} />
              <CopyBlock id="slack1-h" label="Slack message (ready-made)" text={reference.slackTemplate} onCopy={copy} />
              <CopyBlock id="slack2-h" label="Slack message (detailed)" text={DETAILED_SLACK} onCopy={copy} />
            </div>
            <ol className="steps-list">
              <li>In viaSocket, add a step <b>Google Sheets → Add row</b> and map each column to the webhook field of the same name. Paste the header row into row 1 first (it is tab-separated, so it fills one cell per column).</li>
              <li>Add a step <b>Slack → Send message</b> and paste a template above. <code>{'{{field}}'}</code> means “insert that field from the webhook”.</li>
              <li>Publish the flow, then click <b>Send test event</b>.</li>
            </ol>
          </section>
        </StickerCard>
      </div>
    </PageTransition>
  );
}
