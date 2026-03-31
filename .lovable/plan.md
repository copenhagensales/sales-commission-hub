

## Problem

Currently, the pulse survey can be snoozed ("Påmind mig i morgen") indefinitely — every day the user can dismiss it again. The request is to allow only **one** dismissal, after which the system **locks** (like contract/goal locks) until the survey is completed.

## Solution

### 1. Add `dismissal_count` column to `pulse_survey_dismissals`
- **Migration**: Add `dismissal_count integer DEFAULT 0` to `pulse_survey_dismissals`
- This tracks how many times the employee has dismissed a given survey

### 2. Update dismissal logic in `usePulseSurvey.ts`
- **`usePulseSurveyDismissal`**: Also return `dismissalCount` from the query
- **`useDismissPulseSurvey`**: Increment `dismissal_count` when upserting the dismissal row

### 3. Create `usePulseSurveyLock` hook
- New hook (or extend existing) that returns `{ isLocked, isLoading }`:
  - Locked = active survey exists + not completed + not staff + has already dismissed once (dismissal_count >= 1) and dismiss period has expired
  - Essentially: after the first (and only) snooze expires, the user is locked

### 4. Create `PulseSurveyLockOverlay` component
- Full-screen lock overlay (same pattern as `GoalLockOverlay`/`ContractLockOverlay`)
- Shows message: "Du skal besvare pulsmålingen før du kan fortsætte"
- Single button: "Besvar pulsmåling" → navigates to `/pulse-survey`
- No dismiss/snooze option

### 5. Add to `LockOverlays.tsx`
- Import and wire up `usePulseSurveyLock` and `PulseSurveyLockOverlay`
- Priority 5 (after goal lock): if pulse survey lock is active, show the overlay
- Skip on `/pulse-survey` route so the user can actually complete it

### 6. Update `PulseSurveyPopup.tsx`
- Hide the "Påmind mig i morgen" button if `dismissalCount >= 1` (already used their one snooze)
- When locked (dismissal used), the popup won't matter since `LockOverlays` takes over

## Files Changed

| File | Change |
|------|--------|
| **Migration (new)** | Add `dismissal_count` column |
| `src/hooks/usePulseSurvey.ts` | Return `dismissalCount`, increment on dismiss |
| `src/hooks/usePulseSurveyLock.ts` (new) | Lock logic hook |
| `src/components/layout/PulseSurveyLockOverlay.tsx` (new) | Lock overlay UI |
| `src/components/layout/LockOverlays.tsx` | Add pulse survey lock as priority 5 |
| `src/components/pulse/PulseSurveyPopup.tsx` | Hide snooze button after first use |

