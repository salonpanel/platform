# Agenda Redesign — Quick QA & Push Guide

## Files Changed (Git Ready)

```
NEW FILES:
  src/components/calendar/BookingSlidePanel.tsx
  src/components/agenda/MobileStaffTabs.tsx

MODIFIED FILES:
  src/components/agenda/AppointmentCard.tsx (timeline variant)
  src/components/agenda/AgendaContent.tsx (mobile staff tabs)
  app/panel/agenda/AgendaPageClient.tsx (BookingSlidePanel import)
```

---

## Quick Testing (5 min)

### Desktop — Day View
1. Open agenda page, select Day view
2. Look at appointment cards — should show: **time + customer name + service (on hover/wide screen)**
3. **Status badge should NOT appear** on the timeline card
4. Click any appointment → slide panel appears **from the right**, calendar still visible
5. Panel shows: customer name, date, time, service, staff, phone, email
6. Click "Editar" → NewBookingModal opens
7. Press ESC → panel closes

### Mobile (375px viewport)
1. Day view → see **staff tabs** at top (if 2+ staff configured)
2. Tabs show: staff name + color dot + booking count
3. Click a staff name → only that staff's bookings shown in calendar
4. Click "Todos" → all staff visible
5. Click any appointment → **panel slides UP from bottom**, fills screen
6. Panel is scrollable, shows all content
7. Swipe down or press ESC → closes
8. Tap outside panel → closes

---

## Git Commit Message (Recommended)

```
Agenda page redesign: mobile-first UX improvements

- AppointmentCard: simplify timeline variant (progressive disclosure)
  • Compact single-line layout (time + customer + service)
  • Remove status badge from card (moved to detail panel)
  • Fixes grid overcrowding on day/week views

- BookingSlidePanel: replace modal with slide panel
  • Desktop: 400px panel slides from right, preserves calendar context
  • Mobile: full-width panel slides from bottom
  • Accessible: focus trap, ESC key, click-outside to close
  • Glassmorphism design + premium animations

- MobileStaffTabs: single-staff focus for mobile
  • Horizontal pill tabs for staff selection
  • Booking count badges
  • Filters DayView to selected staff
  • Improves UX for 1-3 person salons (typical BookFast use case)

Research-based improvements from Fresha, Acuity, Square, Cal.com patterns.
Verified: TypeScript compilation ✓
```

---

## Vercel Deploy Sequence

1. **Local:** Review changes
   ```bash
   git status
   git diff --stat
   ```

2. **Push to main:**
   ```bash
   git add -A
   git commit -m "Agenda page redesign: mobile-first UX improvements..."
   git push origin main
   ```

3. **Monitor Vercel:**
   - Go to https://vercel.com/salonpanel/platform
   - Watch build status
   - Expected build time: ~90 seconds
   - Check for TypeScript errors (none expected)

4. **Post-Deploy Testing:**
   - Vercel URL: https://pro.bookfast.pro
   - Test on multiple devices
   - Monitor Sentry for runtime errors (expect 0)

---

## Rollback Instructions (If Needed)

If critical issues arise:

```bash
# Revert the last commit
git revert HEAD --no-edit
git push origin main
```

Or revert specific files:

```bash
git checkout HEAD^ -- src/components/agenda/AppointmentCard.tsx
git commit -m "Revert AppointmentCard simplification"
```

---

## Expected Vercel Build Output

✓ Next.js 16.0.8 build completes  
✓ Turbopack compilation successful  
✓ No TypeScript errors  
✓ Zero new warnings  
✓ Build time: ~90s  
✓ Deployment: ~30s  

---

## Success Indicators

After deploy, verify:

1. **Agenda page loads:** No console errors
2. **Timeline cards:** Compact, single-line (day view)
3. **Booking click:** Slide panel appears
4. **Mobile:** Staff tabs visible + functional
5. **Sentry:** No new errors
6. **Analytics:** No spike in page errors

---

## Notes

- All imports are verified ✓
- No breaking changes to existing APIs ✓
- Backward compatible with existing modals ✓
- No database migrations needed ✓
- No environment variables changed ✓

**Ready to push whenever you are!**
