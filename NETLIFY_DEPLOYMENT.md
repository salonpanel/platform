# Netlify Deployment Guide - BookFast Platform

## ⚠️ CRITICAL: Next.js 16 Compatibility Notice

**WARNING**: This project uses Next.js 16, which was released in November 2024. The `@netlify/plugin-nextjs` may not officially support Next.js 16 yet. 

**Before deploying to production:**
1. Test a build on Netlify to verify compatibility
2. If build fails, downgrade to Next.js 15.x:
   ```bash
   npm install next@15@latest react@18@latest react-dom@18@latest
   ```

**Recommended for production**: Use Next.js 15.x until Netlify officially supports Next.js 16.

## Overview
This guide covers deploying the BookFast Next.js platform to Netlify, including Supabase integration and scheduled functions.

## Prerequisites
- Netlify account
- Supabase project with database and auth configured
- Git repository with the code

## Environment Variables

Set these in Netlify Dashboard > Site Settings > Environment Variables:

### Required Supabase Variables
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
INTERNAL_CRON_KEY=generate_random_string_for_cron_security
```

### Application Variables
```
NEXTAUTH_URL=https://your-site.netlify.app
NEXTAUTH_SECRET=your_nextauth_secret
RESEND_API_KEY=your_resend_api_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

## Deployment Steps

### 1. Connect Repository
1. Go to Netlify Dashboard
2. Click "Add new site" > "Import an existing project"
3. Connect your Git provider
4. Select the repository
5. Set build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `.next`
   - **Node version**: `20`

### 2. Configure Environment Variables
Add all environment variables listed above in Netlify's environment variables section.

### 3. Deploy
1. Trigger a deploy (Netlify will automatically deploy on git push)
2. Monitor the build log for any errors

## Post-Deployment Setup

### 1. Verify Supabase Connection
- Test authentication flow
- Check database connectivity
- Verify multi-tenant routing works

### 2. Configure Custom Domain (Optional)
- Add custom domain in Netlify DNS settings
- Update Supabase auth redirect URLs to include your custom domain

### 3. Test Scheduled Functions
The following scheduled functions replace Vercel cron jobs:
- `release-holds`: Runs every 5 minutes
- `calculate-metrics`: Runs daily at 2:00 AM

## Migration from Vercel

### Cron Jobs
Vercel cron jobs in `vercel.json` are replaced by Netlify scheduled functions:
- Functions are located in `netlify/functions/`
- Schedules are defined in `netlify.toml`

### Environment Variables
All Vercel environment variables need to be recreated in Netlify.

### Middleware Considerations
The project uses `@supabase/auth-helpers-nextjs` in `middleware.ts`, which is deprecated by Supabase. This may cause issues on Netlify Edge Functions.

**Known Risk**: If authentication fails or multi-tenant routing breaks after deployment:
1. Consider migrating to `@supabase/ssr` (recommended by Supabase)
2. Test thoroughly in staging environment
3. Monitor edge function logs for auth-related errors

For now, the current setup should work but requires monitoring.

## Troubleshooting

### Build Issues
- **Next.js 16 Compatibility**: Ensure `@netlify/plugin-nextjs` supports your version
- **Node Version**: Verify Node.js 20 is available (set in netlify.toml)
- **Dependencies**: Check if all dependencies are compatible with Netlify's build environment

### Runtime Issues
- **Supabase Auth**: Check CORS settings in Supabase dashboard
- **API Routes**: Verify all API routes work as serverless functions
- **Middleware**: Monitor edge function logs for authentication issues

### Scheduled Functions
- Check function logs in Netlify Dashboard
- Verify CRON_SECRET is set correctly
- Ensure target API endpoints exist and are accessible

## Performance Optimization

### Build Optimization
- Static generation is automatically handled by Next.js
- Images are optimized through Next.js Image component
- CSS is minified by Tailwind CSS

### Caching
- Static assets cached for 1 year (configured in netlify.toml)
- API responses should implement appropriate caching headers
- Consider Netlify's Durable Functions for frequently accessed data

## Security Considerations

### Headers
Security headers are automatically added via netlify.toml:
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- X-Content-Type-Options: nosniff

### Environment Variables
- Never commit sensitive data to repository
- Use Netlify's environment variable management
- Rotate secrets regularly

### Supabase RLS
Ensure Row Level Security policies are properly configured for multi-tenant isolation.

## Monitoring

### Build Logs
Monitor deployment logs in Netlify Dashboard for any build issues.

### Function Logs
Check scheduled function logs for cron job execution status.

### Analytics
Consider integrating Netlify Analytics or external monitoring tools.

## Rollback Plan

If deployment fails:
1. Netlify automatically keeps previous deployments active
2. Use "Deploy locks" to prevent new deploys during troubleshooting
3. Rollback to previous working deploy via Netlify Dashboard
4. Fix issues and redeploy

## Support

For issues specific to:
- **Netlify**: Check Netlify support documentation
- **Next.js**: Refer to Next.js deployment guides
- **Supabase**: Consult Supabase documentation
- **BookFast**: Review project-specific documentation in `/docs`
