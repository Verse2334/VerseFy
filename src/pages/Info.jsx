import { IoLogoDiscord, IoHeart, IoShieldCheckmark, IoWarning, IoLockClosed, IoHandLeft, IoDocument, IoShield } from 'react-icons/io5';
import { getCredit } from '../utils/integrity';
import './Pages.css';

export default function Info() {
  const CREDIT = getCredit() || '⚠ CREDIT TAMPERED';
  return (
    <div className="page">
      <div className="page-header">
        <h1>Info</h1>
        <p className="subtitle">About Versefy</p>
      </div>

      {/* About */}
      <div className="info-card">
        <div className="info-card-header">
          <IoShieldCheckmark className="info-card-icon accent" />
          <h2>About Versefy</h2>
        </div>
        <p className="info-text">
          Versefy is a <strong>free, non-commercial music and SFX management application</strong> built
          by <strong>{CREDIT}</strong>. It is distributed as free software for the community and is not a
          commercial product, streaming service, or platform of any kind. Versefy does not host, stream,
          or provide access to any audio content &mdash; it is a local playback and file management tool only.
        </p>
        <div className="info-creator">
          <div className="info-creator-row">
            <span className="info-label">Created by</span>
            <span className="info-value">{CREDIT}</span>
          </div>
          <div className="info-creator-row">
            <span className="info-label">Twitter / X</span>
            <span className="info-value">@verse_3dd</span>
          </div>
          <div className="info-creator-row">
            <span className="info-label">Discord</span>
            <span className="info-value"><IoLogoDiscord style={{ verticalAlign: 'middle', marginRight: 4 }} /> verse_3d</span>
          </div>
        </div>
        <button className="info-donate-btn" onClick={() => window.open('https://ko-fi.com/versefy', '_blank')}>
          <IoHeart /> Donate / Support
        </button>
      </div>

      {/* Not for Sale */}
      <div className="info-card">
        <div className="info-card-header">
          <IoHandLeft className="info-card-icon warn" />
          <h2>Not for Sale</h2>
        </div>
        <p className="info-text">
          Versefy is <strong>not for sale</strong>, never has been, and never will be. It is and will always
          remain completely free. It is not a paid product and will not be monetized in any form. <strong>Do
          not contact regarding any business inquiries, partnerships, licensing, acquisition, or commercial
          discussions of any kind.</strong> All such messages will be ignored.
        </p>
      </div>

      {/* Terms of Use */}
      <div className="info-card">
        <div className="info-card-header">
          <IoDocument className="info-card-icon accent" />
          <h2>Terms of Use</h2>
        </div>
        <div className="info-legal">
          <p>
            <strong>Acceptance.</strong> By downloading, installing, or using Versefy, you ("the User")
            acknowledge that you have read, understood, and agree to be bound by these terms. If you do not
            agree, you must immediately uninstall and cease all use of the software.
          </p>
          <p>
            <strong>Free Software, Non-Commercial Use.</strong> Versefy is provided free of charge for personal,
            non-commercial use. You may not sell, sublicense, rent, lease, or otherwise commercially exploit
            Versefy or any derivative works. Redistribution is permitted only in its unmodified, original form
            and must remain free of charge.
          </p>
          <p>
            <strong>No Resale or Rebranding.</strong> You may not rebrand, rename, claim authorship of, or
            redistribute Versefy as your own product. All rights, ownership, and credit remain solely with the
            original creator ({CREDIT}).
          </p>
          <p>
            <strong>Strictly No NSFW Content.</strong> Versefy is not intended, designed, or permitted to be used
            for the storage, playback, management, or distribution of any NSFW (Not Safe For Work), explicit,
            pornographic, sexually explicit, or otherwise inappropriate content of any kind. This is a strict,
            zero-tolerance policy. The creator does not consent to, condone, endorse, or support any such use
            of this software under any circumstances. Any use of Versefy for NSFW purposes is a direct violation
            of these terms. By using Versefy, you agree to never use it in connection with any explicit or
            inappropriate material.
          </p>
        </div>
      </div>

      {/* Legal / Disclaimer */}
      <div className="info-card">
        <div className="info-card-header">
          <IoWarning className="info-card-icon warn" />
          <h2>Disclaimer &amp; Legal</h2>
        </div>
        <div className="info-legal">
          <p>
            <strong>No Warranty.</strong> Versefy is provided "AS IS" and "AS AVAILABLE" without warranty of
            any kind, express or implied, including but not limited to the warranties of merchantability,
            fitness for a particular purpose, and non-infringement. The entire risk as to the quality and
            performance of the software is with you. The creator shall not be held liable for any claims,
            damages, or other liability arising from, out of, or in connection with the software or its use.
          </p>
          <p>
            <strong>Not a Streaming Service.</strong> Versefy is not a music streaming service, content delivery
            platform, or file-sharing tool. It does not host, index, catalog, distribute, or provide access to
            any audio content whatsoever. It is a local-only audio file player and organizer. Any audio content
            within the application is sourced, imported, and managed entirely by the individual user on their
            own device.
          </p>
          <p>
            <strong>No Affiliation.</strong> Versefy is an independent project. It is not affiliated with,
            endorsed by, sponsored by, or associated with any third-party service, company, or platform
            including but not limited to Spotify, Apple Music, YouTube, Google, Discord, SoundCloud, or any
            music label, publisher, distributor, or rights holder. All third-party trademarks, logos, and brand
            names belong to their respective owners and are used here for identification purposes only.
          </p>
          <p>
            <strong>User Responsibility &amp; Content.</strong> The user assumes full and sole responsibility
            for ensuring that any audio files they import, download, store, or manage through Versefy comply
            with all applicable copyright laws, intellectual property rights, and regulations in their
            jurisdiction. The creator of Versefy does not encourage, endorse, or facilitate copyright
            infringement in any form. Versefy is a tool &mdash; how it is used is entirely at the user's
            discretion and liability.
          </p>
          <p>
            <strong>YouTube Import Feature.</strong> Versefy includes the ability to import audio via
            third-party open-source tools (yt-dlp). This feature is provided as a convenience and relies
            entirely on third-party software not developed or maintained by the creator of Versefy. The
            creator does not control, moderate, or take responsibility for how this feature is used. Users
            are solely responsible for ensuring their use of this feature complies with YouTube's Terms of
            Service and all applicable laws. The creator expressly disclaims all liability related to the
            use of this feature.
          </p>
          <p>
            <strong>No Liability for Content.</strong> The creator of Versefy is not responsible or liable for
            any content imported, stored, played, shared, or otherwise handled through this application. The
            creator does not monitor, review, approve, or have any knowledge of what content users choose to
            manage with the software. The application is content-agnostic and content-neutral.
          </p>
          <p>
            <strong>Local Network Sharing.</strong> Versefy includes an optional feature to share a single
            audio file over the user's local network. This feature is off by default, user-initiated only,
            and operates exclusively within the user's own local area network. The creator is not responsible
            for any content shared through this feature.
          </p>
          <p>
            <strong>Limitation of Liability.</strong> To the maximum extent permitted by applicable law, in
            no event shall the creator, contributors, or distributors of Versefy be liable for any direct,
            indirect, incidental, special, exemplary, consequential, or punitive damages, including but not
            limited to loss of profits, data, use, goodwill, or other intangible losses, however caused and
            under any theory of liability (whether in contract, tort, negligence, strict liability, or
            otherwise), arising out of or in connection with the use of, inability to use, or reliance on
            this software, even if advised of the possibility of such damages.
          </p>
          <p>
            <strong>Indemnification.</strong> You agree to indemnify, defend, and hold harmless the creator
            of Versefy from and against any and all claims, liabilities, damages, losses, costs, and expenses
            (including reasonable legal fees) arising from your use of the software, your violation of these
            terms, or your violation of any third-party rights including intellectual property rights.
          </p>
          <p>
            <strong>Severability.</strong> If any provision of these terms is found to be unenforceable or
            invalid, that provision shall be limited or eliminated to the minimum extent necessary, and the
            remaining provisions shall remain in full force and effect.
          </p>
        </div>
      </div>

      {/* Security */}
      <div className="info-card info-card-highlight">
        <div className="info-card-header">
          <IoShield className="info-card-icon security" />
          <h2>Security &amp; Your Safety</h2>
        </div>
        <p className="info-text">
          Versefy is built with your privacy and security as the <strong>highest priority</strong>. You are
          <strong> fully safe and secure</strong> while using this application. Here is exactly why:
        </p>
        <div className="info-security-grid">
          <div className="security-item">
            <span className="security-check">&#10003;</span>
            <div><strong>Zero tracking.</strong> No analytics, no telemetry, no usage monitoring. Nothing.</div>
          </div>
          <div className="security-item">
            <span className="security-check">&#10003;</span>
            <div><strong>Zero data collection.</strong> We do not collect, store, transmit, sell, or share any personal information of any kind. Ever.</div>
          </div>
          <div className="security-item">
            <span className="security-check">&#10003;</span>
            <div><strong>No servers.</strong> Versefy has no backend, no cloud, no database, no API. There is literally nowhere for your data to go.</div>
          </div>
          <div className="security-item">
            <span className="security-check">&#10003;</span>
            <div><strong>No accounts.</strong> No sign-ups, no logins, no emails, no passwords. You never give us any information about yourself.</div>
          </div>
          <div className="security-item">
            <span className="security-check">&#10003;</span>
            <div><strong>100% offline.</strong> Everything runs entirely on your device. Your music, playlists, settings, and history never leave your computer.</div>
          </div>
          <div className="security-item">
            <span className="security-check">&#10003;</span>
            <div><strong>No network requests.</strong> Versefy makes zero outbound network connections (except YouTube imports, which you manually trigger, and optional Discord RPC if you enable it).</div>
          </div>
          <div className="security-item">
            <span className="security-check">&#10003;</span>
            <div><strong>No ads, no trackers, no cookies.</strong> There is no advertising, no third-party tracking scripts, and no cookies of any kind.</div>
          </div>
          <div className="security-item">
            <span className="security-check">&#10003;</span>
            <div><strong>No hidden processes.</strong> Versefy runs only when you open it. It does not install background services, scheduled tasks, or startup entries.</div>
          </div>
        </div>
        <p className="info-text" style={{ marginTop: 14, marginBottom: 0 }}>
          <strong>In short: your data is yours and yours alone.</strong> Versefy cannot see, access, or transmit
          anything about you. There is no way for your information to be compromised through this application
          because <em>we never have it in the first place</em>.
        </p>
      </div>

      {/* Privacy */}
      <div className="info-card">
        <div className="info-card-header">
          <IoLockClosed className="info-card-icon accent" />
          <h2>Privacy Details</h2>
        </div>
        <div className="info-legal">
          <p>
            <strong>Local Storage Only.</strong> All data including your music library, playlists, settings,
            play history, and preferences are stored exclusively on your local device using your browser's
            built-in IndexedDB and localStorage. Uninstalling the application removes all associated data.
          </p>
          <p>
            <strong>Third-Party Services.</strong> If you choose to enable optional features such as Discord
            Rich Presence, data (such as the currently playing song title) may be sent to that third-party
            service per that service's own terms and privacy policy. This is entirely opt-in and user-initiated.
          </p>
          <p>
            <strong>Local Sharing.</strong> The song sharing feature operates exclusively on your local network
            and only while you actively have it enabled. It does not upload anything to the internet.
          </p>
        </div>
      </div>

      <div className="info-footer">
        <span>Versefy &mdash; Free Music Player for the Community</span>
        <span>Made with <IoHeart style={{ color: 'var(--accent)', verticalAlign: 'middle', fontSize: 14 }} /> by {CREDIT}</span>
      </div>
    </div>
  );
}
