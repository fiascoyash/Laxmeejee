<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- The Hisaaboo app lives in `src/legacy/` (ported from the user's Bolt/Vite repo) and is rendered client-only from `src/routes/index.tsx`; it navigates by URL hash and stores most data in localStorage, so keep it browser-only. Files carry `// @ts-nocheck` because the original code was never strictly typed.
- Editing an existing invoice saves directly (status derived from recorded payments, Draft preserved); the payment decision dialog is only for new invoices or explicitly finalizing a draft — keeps editing and payment collection separate.
- Keep desktop sidebar collapse separate from the mobile drawer state and use the existing shared hamburger; navigation closes only the drawer so desktop collapse survives page changes.
- Add Stock uses operation IDs, an invoker-permission RPC for atomic cloud histories, and snapshot-backed existing local keys for catalog/history; keep these boundaries to avoid duplicate increments and preserve the browser-local catalog. Additive decimal history fields retain compatibility with legacy integer workflows; use their fallback values in Product Details.
