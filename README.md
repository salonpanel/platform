# Platform - Salon Management System

This is a [Next.js](https://nextjs.org) project for salon management, built with security and best practices in mind.

## 🚀 Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 🛡️ Security

This project uses **OWASP Noir** for automated security analysis and vulnerability detection.

### Quick Security Scan

```bash
# Install OWASP Noir (first time only)
npm run security:install

# Run security scan
npm run security:scan

# Detailed scan with vulnerability detection
npm run security:scan:verbose
```

### Security Documentation

- 📖 [OWASP Noir Documentation](./docs/OWASP_NOIR.md) - Complete guide
- 🚀 [Quick Start Guide](./docs/NOIR_QUICK_START.md) - Fast reference
- 📋 [Security Checklist](./docs/SECURITY_CHECKLIST.md) - Best practices
- 🛡️ [Security Policy](./SECURITY.md) - Reporting vulnerabilities
- 🎯 [Implementation Summary](./IMPLEMENTACION_OWASP_NOIR.md) - Setup details

## 📦 Available Scripts

### Development
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Testing
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate coverage report
- `npm run test:rls` - Test Row Level Security

### Security
- `npm run security:install` - Install OWASP Noir
- `npm run security:scan` - Run security scan
- `npm run security:scan:verbose` - Detailed security scan
- `npm run security:scan:prod` - Scan for production

## 🏗️ Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Styling**: Tailwind CSS
- **Security**: OWASP Noir, RLS, Rate Limiting
- **Deployment**: Vercel

## 📚 Learn More

### Next.js Resources
- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)
- [Next.js GitHub](https://github.com/vercel/next.js)

### Security Resources
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Noir](https://owasp-noir.github.io/noir/)
- [Supabase Security](https://supabase.com/docs/guides/auth/row-level-security)

## 🚀 Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## 🔒 Security First

This project follows security best practices:
- ✅ Automated security scanning with OWASP Noir
- ✅ Row Level Security (RLS) in database
- ✅ Rate limiting on API endpoints
- ✅ Input validation with Zod
- ✅ Secure authentication with Supabase
- ✅ CI/CD security checks

See [SECURITY.md](./SECURITY.md) for our security policy and how to report vulnerabilities.

---

**Version**: 0.1.0  
**License**: Private  
**Last Updated**: 2025-11-21

