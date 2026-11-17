'use client'

// Setup tab of /betfair: how to get (or find again) the Betfair app key,
// with links to Betfair's own tools. Reference only: no keys are entered,
// stored or shown here. They live in Vercel's environment variables.

const C = { panel: '#0b1122', panel2: '#0e1630', line: '#1a2547', fg: '#dbe3f7', mut: '#7784a6', dim: '#4b5677', teal: '#2fd6b0', amb: '#f6b93b', blu: '#6f9bff' }
const SANS = 'system-ui,sans-serif', MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace'

const LINKS = [
  { label: 'Accounts API Demo Tool', note: 'create or look up your app keys', href: 'https://apps.betfair.com/visualisers/api-ng-account-operations/' },
  { label: 'Betfair login', note: 'log in here first, in another tab', href: 'https://www.betfair.com' },
  { label: 'Application Keys guide', note: "Betfair's own documentation", href: 'https://betfair-developer-docs.atlassian.net/wiki/spaces/1smk3cen4v3lu3yomq5qye0ni/pages/2687105/Application+Keys' },
  { label: 'Betfair Developer Support', note: 'if key creation keeps failing', href: 'https://support.developer.betfair.com' },
  { label: 'Vercel dashboard', note: 'Settings → Environment Variables', href: 'https://vercel.com/dashboard' },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: C.panel, border: '1px solid ' + C.line, borderRadius: 12, padding: 16, fontFamily: SANS, fontSize: 14, lineHeight: 1.6, color: C.fg }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600, color: '#fff' }}>{title}</h3>
      {children}
    </section>
  )
}
const code: React.CSSProperties = { fontFamily: MONO, fontSize: 12, background: C.panel2, border: '1px solid ' + C.line, borderRadius: 4, padding: '1px 5px' }

export default function SetupTab({ liveReady }: { liveReady: boolean | undefined }) {
  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '6px 0 10px', display: 'grid', gap: 12 }}>
      <div>
        <h2 style={{ fontFamily: SANS, fontSize: 22, fontWeight: 600, color: '#fff', margin: '10px 0 6px' }}>Betfair connection</h2>
        <p style={{ fontFamily: SANS, fontSize: 14, color: liveReady ? C.teal : C.amb, margin: 0 }}>
          {liveReady === undefined ? 'Checking…' : liveReady
            ? '● All three Betfair settings are present in Vercel. Live prices are available.'
            : '● One or more Betfair settings are missing in Vercel. Live prices are locked until all three are set and the app is redeployed.'}
        </p>
      </div>

      <Section title="Start collecting data">
        <p style={{ margin: '0 0 6px', color: C.mut }}>Nothing is collected until you press Start. Once the key is in Vercel:</p>
        <ol style={{ margin: 0, paddingLeft: 20 }}>
          <li><b>Redeploy</b> in Vercel so the new key is picked up. The line at the top of this tab turns green when all three settings are found.</li>
          <li>Make sure all three database scripts have been run once in the Supabase SQL editor: <span style={code}>050_betfair_paper.sql</span> , <span style={code}>051_betfair_strategies.sql</span> and <span style={code}>052_betfair_prices.sql</span> (the price recorder).</li>
          <li>Open the <b>Strategies</b> tab, press <b>Live prices</b>, then <b>Start</b>. The football tests begin with the next matches kicking off in the next 12 minutes.</li>
          <li>Optionally, open the <b>Desk</b> tab, press <b>Live prices</b>, then <b>Start</b> to run the horse-racing bot too.</li>
          <li><b>Keep this page open</b> in a browser tab. It only collects while open (unless you have Vercel Pro and the cron). Weekend afternoons and midweek evenings have the most football.</li>
        </ol>
        <p style={{ margin: '8px 0 0', color: C.mut, fontSize: 13 }}>First signs it is working: “matches seen” on the Strategies tab goes up within a few minutes of a kick-off, and the first results settle about two hours later. If a red error box appears instead, copy its text into a chat with Claude.</p>
      </Section>

      <Section title="Quick links">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,240px),1fr))', gap: 8 }}>
          {LINKS.map(l => (
            <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" style={{ display: 'block', background: C.panel2, border: '1px solid ' + C.line, borderRadius: 8, padding: '8px 12px', textDecoration: 'none' }}>
              <span style={{ color: C.blu, fontWeight: 600 }}>{l.label} ↗</span>
              <span style={{ display: 'block', color: C.mut, fontSize: 12 }}>{l.note}</span>
            </a>
          ))}
        </div>
      </Section>

      <Section title="Find your app key again">
        <ol style={{ margin: 0, paddingLeft: 20 }}>
          <li>Log in at betfair.com in one tab.</li>
          <li>Open the Accounts API Demo Tool in another tab and refresh it. The <b>Session Token (ssoid)</b> box fills itself in.</li>
          <li>Pick <b>getDeveloperAppKeys</b> from the list at the top left and click <b>Execute</b>.</li>
          <li>Copy the key marked <b>Version 1.0-DELAY</b>. That is the free delayed key this desk uses.</li>
        </ol>
      </Section>

      <Section title="Create a key for the first time">
        <ol style={{ margin: 0, paddingLeft: 20 }}>
          <li>Log in at betfair.com, then open and refresh the Accounts API Demo Tool, as above.</li>
          <li>Pick <b>createDeveloperAppKeys</b>.</li>
          <li>Enter an <b>Application Name</b>: letters and numbers only, unique, and with no part of your Betfair username in it (for example <span style={code}>fsdesk20261117</span>).</li>
          <li>Click <b>Execute</b>. Two keys appear under Developer Apps. Copy the one marked <b>Version 1.0-DELAY</b>.</li>
          <li>Ignore the other one: it is the live key, inactive, and costs £499 to activate. Paper testing does not need it.</li>
        </ol>
      </Section>

      <Section title="If key creation fails">
        <p style={{ margin: '0 0 6px', color: C.mut }}>Betfair does not document this error. In order of likelihood:</p>
        <ol style={{ margin: 0, paddingLeft: 20 }}>
          <li><b>You already have keys.</b> Each account gets one set. Run <b>getDeveloperAppKeys</b> instead.</li>
          <li><b>The name was rejected.</b> Try a plain, unique name with no part of your username.</li>
          <li><b>The session expired.</b> Log out of betfair.com, log back in and refresh the tool.</li>
          <li><b>The account is not fully verified.</b> Check for any ID verification request in your Betfair account.</li>
          <li>Still failing: contact Betfair Developer Support with your username and the exact error text.</li>
        </ol>
      </Section>

      <Section title="If the login fails with HTTP 403">
        <p style={{ margin: '0 0 6px' }}>Betfair turns away logins from the US and some other countries. Vercel runs functions in Washington DC unless told otherwise, so the fix is usually to move them:</p>
        <ol style={{ margin: 0, paddingLeft: 20 }}>
          <li>In Vercel, open your FlowState project → <b>Settings</b> → <b>Functions</b>.</li>
          <li>Under <b>Function Regions</b>, choose <b>London (lhr1)</b> and save. On the free plan this moves all of FlowState&apos;s server code to London, which is fine.</li>
          <li><b>Redeploy</b> (Deployments → the latest one → ⋯ → Redeploy). The region change only applies to new deployments.</li>
          <li>Press Start again. The error message now says which region the login came from, so you can confirm it reads <span style={code}>lhr1</span>.</li>
        </ol>
        <p style={{ margin: '8px 0 0', color: C.mut, fontSize: 13 }}>If it still fails from <span style={code}>lhr1</span>, Betfair is blocking the server itself rather than the country. Contact Betfair Developer Support with the error text.</p>
      </Section>

      <Section title="Where the settings go">
        <p style={{ margin: '0 0 6px' }}>In Vercel → your FlowState project → Settings → Environment Variables, set all three, then redeploy:</p>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li><span style={code}>BF_USERNAME</span> your Betfair username</li>
          <li><span style={code}>BF_PASSWORD</span> your Betfair password</li>
          <li><span style={code}>BF_APP_KEY</span> the delayed app key</li>
        </ul>
        <p style={{ margin: '8px 0 0', color: C.mut, fontSize: 13 }}>They are only ever read on the server. Never paste them into this page, a chat or the code. A changed variable takes effect after the next deploy.</p>
      </Section>
    </div>
  )
}
