import type { ReactElement } from "react";

export function PrivacyNotice(): ReactElement {
  return (
    <details className="privacy-notice" id="privacy">
      <summary>Privacy notice</summary>
      <div className="privacy-copy">
        <p>
          Säävirta uses personal data to provide forecasts, manage invitations
          and protect the service from abuse. It has no advertising or analytics
          cookies.
        </p>
        <p>
          <strong>Access.</strong> Your invited email is stored in Infisical,
          Cloudflare Access and private infrastructure state. Cloudflare handles
          email verification and essential security cookies, and records login
          attempts with your email, IP address, time and outcome. Invitations
          are kept while access is granted; authentication logs follow{" "}
          <a
            href="https://developers.cloudflare.com/cloudflare-one/insights/logs/"
            target="_blank"
            rel="noreferrer"
          >
            Cloudflare’s retention periods
          </a>
          . Older invitation data can remain in secret history, infrastructure
          state copies and backups until those copies are removed separately.
        </p>
        <p>
          <strong>Locations.</strong> Search terms and selected coordinates are
          sent through our server to Open-Meteo for weather results. Device
          coordinates stay out of shared caches and page URLs unless you choose
          to save or share the location. Other selected locations can appear in
          URLs and cached results. Search results are cached for one hour,
          forecasts for two hours and weather comparisons for up to three days.
          Open-Meteo may retain request logs, including coordinates, for 90 days
          under its{" "}
          <a
            href="https://open-meteo.com/en/terms"
            target="_blank"
            rel="noreferrer"
          >
            privacy policy
          </a>
          .
        </p>
        <p>
          <strong>Your browser.</strong> Your appearance preference and any
          location you choose to remember stay on this device until you change
          them or clear site data. Signing out ends your Cloudflare Access
          session; it does not remove saved locations or preferences.
        </p>
        <p>
          <strong>Questions or removal.</strong> Contact the person who invited
          you to request access to, correction or deletion of your data, or to
          raise a privacy concern. Removing an invitation does not automatically
          erase logs or retained copies; these must be reviewed separately.
        </p>
        <p>
          Service providers:{" "}
          <a
            href="https://www.cloudflare.com/privacypolicy/"
            target="_blank"
            rel="noreferrer"
          >
            Cloudflare
          </a>
          ,{" "}
          <a
            href="https://infisical.com/privacy"
            target="_blank"
            rel="noreferrer"
          >
            Infisical
          </a>{" "}
          and Open-Meteo. Updated 16 October 2026.
        </p>
      </div>
    </details>
  );
}
