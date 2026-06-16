# Weekly Review Decks

Static dashboards & review decks for Hello Nancy marketing, published via **GitHub Pages** at
**https://marketingnancy.github.io/weeklyreviewdecks/**.

Each deck is a self-contained static bundle (HTML/CSS/JS + a baked data file). All business data is
**AES-256-GCM encrypted behind a password** and decrypted client-side — the repo is public, but no
revenue, ROAS, spend, or campaign data is readable without the login. Plaintext sources (CSVs, DBs,
`.env`) live only in each deck's private source repo and are never published here.

## Decks

- **[localization/](localization/)** — **Localization Daily** dashboard (non-English markets): revenue,
  ROAS, campaigns, creative & translation QA. Baked from the source dashboard
  (`python3 -m localization.web.build_static`).
- **[nancylem/](nancylem/)** — **LEM Weekly Review**: paid-acquisition review for the LEM hero product
  (*Lem Clitoral Massager*) — Command Scorecard, campaign efficiency by funnel, landing-page analysis,
  top creative, and age/gender. An 18-slide present-mode deck. Source repo: `lem-weekly-review` (private,
  local). Data pulled from Shopify + Glued.

Both decks are **password-protected** — credentials are shared with the team privately, not in this repo.

## How a deck gets published

Each deck is built and encrypted in its own source repo, then its `build_static/` output is copied
into a sibling folder here:

```bash
# in the deck's source repo (e.g. ~/Documents/lem-weekly-review)
python3 -m app.build_static                                   # bake deck.json + copy the SPA
DECK_PASSWORD='<password>' DECK_USER='nancy' node web/encrypt.js build_static   # encrypt the data
# then copy build_static/* into weeklyreviewdecks/<deck>/ , commit, and push
```

The encrypt step writes `data/enc.json` (salt + a check token, the only plaintext) and turns every
`data/*.json` into `base64(iv|ciphertext|tag)`. The deck's `app.js` shows a login form, derives the
key via PBKDF2/Web Crypto, and decrypts in the browser.

## Adding a new deck

Drop the encrypted `build_static/` output into a new sibling folder, then add a card linking to it in
the root [`index.html`](index.html). GitHub Pages serves it automatically (source: `main` branch root).

## Security notes

- The repo is **public**; safety comes from client-side encryption, not repo privacy.
- Never commit `.env`, `*.db`, `*.sqlite`, or any plaintext data export here (see `.gitignore`).
- To rotate a deck password, re-run the encrypt step with a new `DECK_PASSWORD` and re-publish.
