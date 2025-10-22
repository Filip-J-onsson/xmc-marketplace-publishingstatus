# HTTPS Setup Instructions

## Trusted Certificate Setup

This project uses `vite-plugin-mkcert` to automatically create trusted local certificates. The first time you run the development server, it will:

1. **Install mkcert** (if not already installed)
2. **Create a local Certificate Authority (CA)**
3. **Generate trusted certificates** for localhost
4. **Install the CA** in your system's trust store

## First Run Setup

When you run `npm run dev` for the first time, you may see prompts to:

### Windows:
- Allow the certificate installation in Windows Certificate Store
- Click "Yes" when prompted by Windows Security

### macOS:
- Enter your admin password to install the CA in Keychain
- Click "Allow" or "Always Allow" when prompted

### Linux:
- Enter your sudo password to install the CA

## No Browser Warnings!

After the initial setup, you should see:
- ✅ Green padlock in your browser
- ✅ No security warnings
- ✅ Trusted HTTPS connection

## Troubleshooting

If you still see certificate warnings:

1. **Restart your browser** after the first setup
2. **Clear browser cache** and reload the page
3. **Run the dev server again** - mkcert may need to regenerate certificates

## Why HTTPS is Required

Sitecore Marketplace requires HTTPS for:
- Security compliance
- Iframe communication security
- Production environment compatibility
- Cross-origin resource sharing (CORS) policies

## Production Deployment

For production, use a proper SSL certificate from:
- Let's Encrypt (free)
- Your hosting provider
- Commercial certificate authority

The mkcert certificates are only for local development.
