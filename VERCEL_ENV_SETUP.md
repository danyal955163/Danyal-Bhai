# Vercel Environment Variables

Add these in **Vercel Dashboard → Settings → Environment Variables**:

## Required (Supabase)

- `NEXT_PUBLIC_SUPABASE_URL` — from Supabase → Settings → API
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase → Settings → API
- `SUPABASE_SERVICE_ROLE_KEY` — from Supabase → Settings → API

## Required (AI Chat)

- `OPENROUTER_API_KEY` — from [openrouter.ai/keys](https://openrouter.ai/keys)

## Optional

- `NEXT_PUBLIC_SITE_URL` — `https://danyal-bhai.vercel.app`

## Setup Steps

1. Copy each value from the Supabase and OpenRouter dashboards.
2. In Vercel, open **Settings → Environment Variables → Add New**.
3. Add each value as a secret.
4. Select **all environments**: Production, Preview, and Development.
5. After adding the variables, redeploy the project.

## Verify

After deployment, test:

- Signup with a new account redirects to `/chat`.
- Chat with AI returns a response and voice output works.
- The avatar animates while speaking.
