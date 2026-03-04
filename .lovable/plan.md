

## Problem

The forecast hook (`useTeamGoalForecast.ts`) currently fetches **all sales** by an employee's agent email, regardless of which team/client the sale belongs to. This means when Benjamin and Hans switched from Eesy to Relatel, their Eesy sales are incorrectly included in the Relatel forecast.

Per the business rule documented in memory: sales ownership is determined by the **client's team assignment** via the `team_clients` table, not the seller's team membership.

## Fix

In `useTeamGoalForecast.ts`, add a filter so that only sales for clients assigned to the selected team are counted:

1. **Fetch `team_clients`** for the selected `teamId` to get the list of `client_id`s belonging to that team
2. **Fetch `client_campaigns`** for those client IDs to get the relevant `campaign_id`s
3. **Filter the sales query** by adding `.in("client_campaign_id", campaignIds)` so only sales attributed to the team's clients are included

This ensures that when an employee moves teams, their historical sales stay with the old team's clients, matching how the rest of the system attributes sales.

## Changes

**`src/hooks/useTeamGoalForecast.ts`** — Between fetching employee emails and fetching sales (around line 94):
- Query `team_clients` for the selected `teamId` → get `client_id[]`
- Query `client_campaigns` for those client IDs → get campaign `id[]`  
- Add `.in("client_campaign_id", campaignIds)` to the sales query on line 104-109
- If no campaigns found, skip sales fetch (all zeros)

