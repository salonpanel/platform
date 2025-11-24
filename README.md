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

This project follows security best practices with Row Level Security (RLS), rate limiting, and input validation.

### Security Documentation

- 📋 [Security Checklist](./docs/SECURITY_CHECKLIST.md) - Best practices
- 🛡️ [Security Policy](./SECURITY.md) - Reporting vulnerabilities

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

## 🏗️ Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Styling**: Tailwind CSS
- **Security**: RLS, Rate Limiting, Input Validation
- **Deployment**: Vercel

## 📚 Learn More

### Next.js Resources
- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)
- [Next.js GitHub](https://github.com/vercel/next.js)

### Security Resources
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security](https://supabase.com/docs/guides/auth/row-level-security)

## 🚀 Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## 🔒 Security First

This project follows security best practices:
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

