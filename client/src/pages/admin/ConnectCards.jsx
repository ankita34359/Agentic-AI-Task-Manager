import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import StickerCard from '../../components/StickerCard.jsx';
import SquishyButton from '../../components/SquishyButton.jsx';
import { useToast } from '../../components/Toasts.jsx';
import { useBurst } from '../../components/Burst.jsx';
import { api } from '../../lib/api.js';
import { copyText } from '../../lib/clipboard.js';
import { errorMessage } from '../../lib/errors.js';

// viaSocket's Connect popup script. The popup must be opened from the click itself, so the script and the
// per-workspace embed token are loaded as soon as the cards appear, never inside the click handler.
const CONNECT_SCRIPT = 'https://flow.viasocket.com/connect.js';
const BASE = '/api/integrations/viasocket';
const REQUIRED_COLUMNS = ['event', 'taskId', 'title', 'owner', 'status', 'impact', 'deadline', 'at', 'text'];

function loadConnectScript() {
  if (typeof window.openViasocketConnection === 'function') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${CONNECT_SCRIPT}"]`);
    const s = existing || document.createElement('script');
    s.addEventListener('load', resolve, { once: true });
    s.addEventListener('error', () => reject(new Error("Couldn't load the viaSocket Connect button. Check your connection.")), { once: true });
    if (!existing) {
      s.src = CONNECT_SCRIPT;
      document.head.appendChild(s);
    }
  });
}

const SheetsIcon = () => (
  <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <rect x="9" y="5" width="30" height="38" rx="5" fill="#fff" stroke="currentColor" strokeWidth="3" />
    <path d="M9 18h30M9 29h30M22 18v25" stroke="currentColor" strokeWidth="3" fill="none" />
    <rect x="9" y="5" width="30" height="13" rx="5" fill="currentColor" opacity=".22" />
  </svg>
);
const SlackIcon = () => (
  <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <path d="M18 8v32M30 8v32M8 18h32M8 30h32" stroke="currentColor" strokeWidth="5" strokeLinecap="round" fill="none" />
  </svg>
);

/** Accessible on/off switch with a squishy thumb. */
function Switch({ checked, disabled, onChange, label }) {
  const reduced = useReducedMotion();
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className={`switch${checked ? ' switch--on' : ''}`} onClick={() => onChange(!checked)}>
      <motion.span className="switch__thumb" layout={!reduced} transition={{ type: 'spring', stiffness: 700, damping: 22 }} />
      <span className="switch__text" aria-hidden="true">
        {checked ? 'ON' : 'OFF'}
      </span>
    </button>
  );
}

/**
 * A dropdown fed by viaSocket's option lists (searchable, pageable). Shows labels, sends values verbatim.
 * `path` is the options URL without paging params; `reloadKey` changes when what it depends on changes.
 */
function Picker({ id, label, path, disabled, placeholder, searchable = false, savedLabel, onPick }) {
  const [state, setState] = useState({ options: [], paginate: null, hasMore: false, message: null, loading: false, error: '' });
  const [search, setSearch] = useState('');
  const [value, setValue] = useState('');
  const seq = useRef(0);

  const load = useCallback(
    async ({ term = '', paginate = null, append = false } = {}) => {
      const mine = ++seq.current;
      setState((s) => ({ ...s, loading: true, error: '' }));
      try {
        const qs = `${path}${path.includes('?') ? '&' : '?'}${term ? `search=${encodeURIComponent(term)}&` : ''}${paginate ? `paginate=${encodeURIComponent(paginate)}` : ''}`;
        const r = await api.get(qs.replace(/[?&]$/, ''));
        if (mine !== seq.current) return;
        setState((s) => ({ options: append ? [...s.options, ...r.options.filter((o) => !s.options.some((x) => x.value === o.value))] : r.options, paginate: r.paginate, hasMore: r.hasMore, message: r.message, loading: false, error: '' }));
      } catch (err) {
        if (mine === seq.current) setState((s) => ({ ...s, loading: false, error: err.body?.message || errorMessage(err, 'calm') }));
      }
    },
    [path],
  );

  useEffect(() => {
    if (disabled) return undefined;
    setValue('');
    const t = setTimeout(() => load({ term: search }), search ? 300 : 0); // debounce typing, load at once otherwise
    return () => clearTimeout(t);
  }, [disabled, load, search]);

  return (
    <div className="picker">
      <label htmlFor={id} className="picker__label">
        {label}
      </label>
      {savedLabel && <p className="picker__saved">Saved: <b>{savedLabel}</b></p>}
      {searchable && <input className="input picker__search" type="search" aria-label={`Search ${label.toLowerCase()}`} placeholder="Type to search…" value={search} disabled={disabled} onChange={(e) => setSearch(e.target.value)} />}
      <select
        id={id}
        className="input picker__select"
        value={value}
        disabled={disabled || (state.loading && !state.options.length)}
        onChange={(e) => {
          const opt = state.options.find((o) => o.value === e.target.value);
          setValue(e.target.value);
          if (opt) onPick(opt);
        }}
      >
        <option value="">{disabled ? placeholder : state.loading && !state.options.length ? 'Loading…' : state.options.length ? `Choose…` : 'Nothing found'}</option>
        {state.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {state.hasMore && (
        <button type="button" className="picker__more" disabled={state.loading} onClick={() => load({ term: search, paginate: state.paginate, append: true })}>
          {state.loading ? 'Loading…' : 'Show more'}
        </button>
      )}
      {state.message && <p className="field__msg">{state.message}</p>}
      {state.error && (
        <p className="field__msg field__msg--error" role="alert">
          {state.error}
        </p>
      )}
    </div>
  );
}

function ConnectCard({ app, state, setup, setupError, onConnectClick, onState, tilt, index }) {
  const toast = useToast();
  const burst = useBurst();
  const reduced = useReducedMotion();
  const isSheets = app === 'sheets';
  const [spreadsheet, setSpreadsheet] = useState(null); // the spreadsheet picked in this visit, to list its worksheets
  const [busy, setBusy] = useState('');
  const [confirm, setConfirm] = useState(''); // '' | 'disconnect' | 'test'
  const [testNote, setTestNote] = useState(null);
  const title = isSheets ? 'Google Sheets' : 'Slack';
  const blurb = isSheets ? 'Every new outcome and every move adds a row to a sheet you choose.' : 'Every new outcome and every move posts a short message to a channel you choose.';

  async function call(name, fn, success) {
    setBusy(name);
    try {
      const data = await fn();
      onState(data.connect);
      if (success) toast.success(success[0], success[1]);
      return data;
    } catch (err) {
      toast.error("That didn't work", err.body?.message || errorMessage(err, 'calm'));
      return null;
    } finally {
      setBusy('');
    }
  }

  const pickSheet = async (grid) => {
    const r = await call('target', () => api.put(`${BASE}/sheets/target`, { spreadsheetId: spreadsheet.value, spreadsheetName: spreadsheet.label, gridId: grid.value, gridName: grid.label }), null);
    if (r?.connect.sheets.ready) toast.success('Worksheet saved', 'Switch it on when you are ready.');
    else if (r) toast.warn('Column titles missing', 'Row 1 of that worksheet needs all nine titles.');
  };
  const pickChannel = (ch) => call('target', () => api.put(`${BASE}/slack/target`, { channelId: ch.value, channelName: ch.label }), ['Channel saved', 'Switch it on when you are ready.']);
  const toggle = (enabled) => call('enabled', () => api.put(`${BASE}/${app}/enabled`, { enabled }), [enabled ? `${title} is on` : `${title} is off`, enabled ? 'New outcomes and moves will go there.' : 'Nothing more is sent there.']);
  const disconnect = async () => {
    setConfirm('');
    await call('disconnect', () => api.del(`${BASE}/${app}`), [`${title} disconnected`, 'Nothing is deleted in your account.']);
    setSpreadsheet(null);
  };
  const sendTest = async () => {
    setConfirm('');
    setBusy('test');
    setTestNote(null);
    try {
      const r = await api.post(`${BASE}/${app}/test`);
      onState(r.connect);
      setTestNote(r.result.ok ? { ok: true, text: isSheets ? 'Test row sent. Check your sheet.' : 'Test message sent. Check Slack.' } : { ok: false, text: `Failed: ${r.result.detail}` });
      if (r.result.ok) burst('SENT!');
    } catch (err) {
      setTestNote({ ok: false, text: err.body?.message || errorMessage(err, 'calm') });
    } finally {
      setBusy('');
    }
  };

  const statusChip = !state.connected ? ['Not connected', ''] : state.enabled ? ['On', ' chip--ok'] : state.ready ? ['Connected · off', ' chip--ok'] : ['Connected · pick a target', ' chip--ok'];
  const sheetFix = state.missingColumns?.length > 0;

  return (
    <motion.div initial={{ opacity: 0, y: reduced ? 0 : 26, rotate: reduced ? 0 : tilt * 3 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 18, delay: 0.08 * index }}>
      <StickerCard color="paper" tilt={tilt} hover={false} className="connect-card" data-app={app}>
        <section className="connect-card__body" aria-labelledby={`cc-${app}`}>
          <div className={`connect-card__band connect-card__band--${app}`}>
            <span className="connect-card__icon">{isSheets ? <SheetsIcon /> : <SlackIcon />}</span>
            <h2 id={`cc-${app}`} className="card-title">
              {title}
            </h2>
            <span className={`chip${statusChip[1]}`} role="status">
              {statusChip[0]}
            </span>
          </div>
          <div className="connect-card__inner">
            <p className="card-note">{blurb}</p>

            {!state.connected && (
              <div className="btn-row">
                <SquishyButton onClick={() => onConnectClick(app)} disabled={!setup || !!setupError} burst={setup ? 'LINK!' : undefined}>
                  {setupError ? 'Connect unavailable' : !setup ? 'Getting ready…' : `Connect ${title}`}
                </SquishyButton>
              </div>
            )}
            {!state.connected && setupError && (
              <p className="field__msg field__msg--error" role="alert">
                {setupError}
              </p>
            )}

            {state.connected && (
              <>
                {isSheets ? (
                  <>
                    <Picker id="pick-spreadsheet" label="Spreadsheet" path={`${BASE}/sheets/options?field=spreadsheet`} searchable placeholder="" savedLabel={state.spreadsheetName} onPick={setSpreadsheet} />
                    <Picker
                      id="pick-worksheet"
                      label="Worksheet"
                      path={`${BASE}/sheets/options?field=sheet&spreadsheetId=${encodeURIComponent(spreadsheet?.value || '')}`}
                      disabled={!spreadsheet}
                      placeholder="Choose a spreadsheet first"
                      savedLabel={state.sheetName}
                      onPick={pickSheet}
                    />
                    {sheetFix && (
                      <div className="connect-warn" role="alert">
                        <b>Row 1 of that worksheet needs these column titles:</b>
                        <code>{REQUIRED_COLUMNS.join('  |  ')}</code>
                        <p>Missing now: {state.missingColumns.join(', ')}.</p>
                        <SquishyButton size="sm" variant="ghost" onClick={async () => ((await copyText(REQUIRED_COLUMNS.join('\t'))) ? toast.success('Header row copied', 'Paste it into row 1.') : toast.error("Couldn't copy", 'Select it and copy by hand.'))}>
                          Copy header row
                        </SquishyButton>
                        <p className="card-note--small">After fixing row 1, choose the worksheet again.</p>
                      </div>
                    )}
                  </>
                ) : (
                  <Picker id="pick-channel" label="Channel" path={`${BASE}/slack/options?field=channel`} searchable={false} placeholder="" savedLabel={state.channelName} onPick={pickChannel} />
                )}

                <div className="connect-switch">
                  <span id={`sw-${app}`}>Send events here</span>
                  <Switch checked={state.enabled} disabled={!state.ready || !!busy} label={`${title} on or off`} onChange={toggle} />
                </div>

                <div className="btn-row">
                  {confirm === 'test' ? (
                    <>
                      <SquishyButton size="sm" onClick={sendTest}>
                        {isSheets ? 'Yes, add a test row' : 'Yes, post a test message'}
                      </SquishyButton>
                      <SquishyButton size="sm" variant="ghost" onClick={() => setConfirm('')}>
                        No
                      </SquishyButton>
                    </>
                  ) : (
                    <SquishyButton size="sm" variant="ghost" disabled={!state.ready || busy === 'test'} onClick={() => setConfirm('test')}>
                      {busy === 'test' ? 'Sending…' : isSheets ? 'Send a test row' : 'Send a test message'}
                    </SquishyButton>
                  )}
                  {confirm === 'disconnect' ? (
                    <>
                      <SquishyButton size="sm" variant="pink" onClick={disconnect}>
                        Yes, disconnect
                      </SquishyButton>
                      <SquishyButton size="sm" variant="ghost" onClick={() => setConfirm('')}>
                        Keep
                      </SquishyButton>
                    </>
                  ) : (
                    <SquishyButton size="sm" variant="ghost" onClick={() => setConfirm('disconnect')}>
                      Disconnect
                    </SquishyButton>
                  )}
                </div>
                {confirm === 'test' && <p className="field__msg">This writes one real {isSheets ? 'row to your sheet' : 'message to your channel'}.</p>}
                {testNote && (
                  <p className={`test-result test-result--${testNote.ok ? 'ok' : 'bad'}`} role="status">
                    {testNote.ok ? '✓ ' : '✗ '}
                    {testNote.text}
                  </p>
                )}
              </>
            )}
          </div>
        </section>
      </StickerCard>
    </motion.div>
  );
}

/** The two "Connect" cards. `connect` is the server's view (names and on/off only); `onState` replaces it. */
export default function ConnectCards({ connect, onState }) {
  const toast = useToast();
  const burst = useBurst();
  const [setup, setSetup] = useState(null); // { token, apps } from the server; the token is the one value the browser may hold
  const [setupError, setSetupError] = useState('');
  const lastApp = useRef(null);
  const setupRef = useRef(null);
  setupRef.current = setup;

  // Token + popup script, once, as soon as viaSocket is configured on the server.
  useEffect(() => {
    if (!connect?.configured) return undefined;
    let alive = true;
    Promise.all([api.get(`${BASE}/token`), loadConnectScript()])
      .then(([s]) => alive && setSetup(s))
      .catch((err) => alive && setSetupError(err.body?.message || err.message || errorMessage(err, 'calm')));
    return () => {
      alive = false;
    };
  }, [connect?.configured]);

  // The popup reports back by postMessage. The browser only names an auth id: the server checks that viaSocket lists it for this workspace.
  useEffect(() => {
    async function onMessage(event) {
      const d = event.data;
      if (!d || typeof d !== 'object' || typeof d.type !== 'string' || !d.type.startsWith('viasocket_connection_')) return;
      const apps = setupRef.current?.apps || {};
      const byService = Object.entries(apps).find(([, a]) => a.serviceId && a.serviceId === d.serviceId)?.[0];
      const app = byService || lastApp.current;
      if (!app) return;
      if (d.type === 'viasocket_connection_success' && d.data?.id) {
        try {
          const r = await api.post(`${BASE}/${app}/connected`, { authId: String(d.data.id) });
          onState(r.connect);
          burst('LINKED!');
          toast.success(`${app === 'sheets' ? 'Google Sheets' : 'Slack'} connected`, 'Now choose where events should go.');
        } catch (err) {
          toast.error("Couldn't finish connecting", err.body?.message || errorMessage(err, 'calm'));
        }
      } else if (d.type === 'viasocket_connection_error') {
        toast.error("Couldn't connect", String(d.error?.message || 'viaSocket reported a problem.').slice(0, 160));
      }
      // 'viasocket_connection_closed' is not a failure: a success may still follow.
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onState, toast, burst]);

  // Called straight from the click: the popup has to open before any await.
  const openConnect = useCallback((app) => {
    const s = setupRef.current;
    if (!s || typeof window.openViasocketConnection !== 'function') return;
    lastApp.current = app;
    const a = s.apps[app];
    window.openViasocketConnection(s.token, a.serviceId, { filteredActions: [a.actionId], skipActionSelection: true });
  }, []);

  if (!connect) return null;
  if (!connect.configured) {
    return (
      <StickerCard color="paper" tilt={0.2} hover={false} className="int-card">
        <section className="pad" aria-labelledby="cc-off">
          <h2 id="cc-off" className="card-title">
            Connect Google Sheets and Slack <span className="chip">Needs setup</span>
          </h2>
          <p className="card-note">
            This server is missing {connect.missing.map((m) => <code key={m}>{m}</code>).reduce((a, b) => [a, ', ', b])}. Add them in the hosting settings and restart the app. Until then the Events URL below still works.
          </p>
        </section>
      </StickerCard>
    );
  }
  return (
    <div className="connect-grid">
      <ConnectCard app="sheets" state={connect.sheets} setup={setup} setupError={setupError} onConnectClick={openConnect} onState={onState} tilt={-0.5} index={0} />
      <ConnectCard app="slack" state={connect.slack} setup={setup} setupError={setupError} onConnectClick={openConnect} onState={onState} tilt={0.5} index={1} />
    </div>
  );
}
