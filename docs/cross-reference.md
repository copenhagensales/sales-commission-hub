# Cross-reference

Auto-genereret: 2026-05-06T14:16:52.179Z

Kortlægger afhængigheder mellem DB-laget og UI-laget. Brug denne fil for at besvare:
- *"Hvis jeg ændrer tabel X — hvilke hooks/sider knækker?"*
- *"Hvor bliver RPC Y kaldt fra?"*
- *"Hvilke komponenter bruger hook Z?"*

**Tæller både frontend (`src/`) og edge functions (`supabase/functions/`).**

---

## 1. Tabel → Forbrugere

Total: **238** tabeller refereret i kode.

### `absence_request_v2` (25)
- src/components/absence/PendingAbsencePopup.tsx
- src/components/employee/EmployeeCommissionHistory.tsx
- src/components/kpi/FormulaLiveTest.tsx
- src/components/layout/AppSidebar.tsx
- src/components/vagt-flow/AddEmployeeDialog.tsx
- src/components/vagt-flow/CapacityPanel.tsx
- src/components/vagt-flow/EditBookingDialog.tsx
- src/hooks/useAssistantHoursCalculation.ts
- src/hooks/useDashboardKpiData.ts
- src/hooks/useFmBookingConflicts.ts
- src/hooks/useKpiTest.ts
- src/hooks/useSellerSalariesCached.ts
- src/hooks/useShiftPlanning.ts
- src/hooks/useStaffHoursCalculation.ts
- src/hooks/useTeamGoalForecast.ts
- src/pages/EmployeeDetail.tsx
- src/pages/MyGoals.tsx
- src/pages/MyProfile.tsx
- src/pages/dashboards/CphSalesDashboard.tsx
- src/pages/reports/DailyReports.tsx
- src/pages/shift-planning/ShiftOverview.tsx
- src/pages/vagt-flow/Bookings.tsx
- src/pages/vagt-flow/BookingsContent.tsx
- supabase/functions/gdpr-export-data/index.ts
- supabase/functions/tv-dashboard-data/index.ts

### `accounts_map` (1)
- supabase/functions/economic-webhook/index.ts

### `adversus_campaign_mappings` (16)
- src/components/calls-analytics/CallsAnalytics.tsx
- src/components/dashboard/DailyRevenueChart.tsx
- src/components/mg-test/CommissionRatesTab.tsx
- src/components/mg-test/ProductCampaignOverrides.tsx
- src/components/mg-test/ProductPricingRulesDialog.tsx
- src/hooks/useKpiTest.ts
- src/pages/MgTest.tsx
- src/pages/reports/DailyReports.tsx
- src/pages/reports/RevenueByClient.tsx
- src/pages/vagt-flow/LocationDetail.tsx
- supabase/functions/adversus-sync-v2/index.ts
- supabase/functions/adversus-webhook/index.ts
- supabase/functions/dialer-webhook/index.ts
- supabase/functions/rematch-pricing-rules/index.ts
- supabase/functions/sync-adversus/index.ts
- supabase/functions/tv-dashboard-data/index.ts

### `adversus_events` (8)
- src/components/adversus/CphAdversusApiTab.tsx
- src/components/api-overview/ApiDataOverview.tsx
- src/components/api-overview/EventDataTable.tsx
- src/components/system-stability/WebhookActivity.tsx
- src/pages/Settings.tsx
- supabase/functions/adversus-webhook/index.ts
- supabase/functions/dialer-webhook/index.ts
- supabase/functions/sync-adversus/index.ts

### `adversus_product_mappings` (6)
- src/components/mg-test/CampaignSuggestionDialog.tsx
- src/components/mg-test/ProductMergeDialog.tsx
- src/pages/MgTest.tsx
- supabase/functions/adversus-webhook/index.ts
- supabase/functions/dialer-webhook/index.ts
- supabase/functions/rematch-pricing-rules/index.ts

### `agent_presence` (2)
- src/hooks/useTwilioDevice.ts
- supabase/functions/twilio-voice-token/index.ts

### `agents` (21)
- src/components/api-overview/ApiDataOverview.tsx
- src/components/api-overview/EventDataTable.tsx
- src/components/cancellations/LocateSaleDialog.tsx
- src/components/cancellations/MatchErrorsSubTab.tsx
- src/components/cancellations/UploadCancellationsTab.tsx
- src/components/employees/DialerMappingTab.tsx
- src/components/shift-planning/MissingShiftsAlert.tsx
- src/hooks/useAgentNameResolver.ts
- src/pages/Agents.tsx
- src/pages/MgTest.tsx
- src/pages/UnitedDashboard.tsx
- src/pages/compliance/ComplianceNotifications.tsx
- src/pages/personnel/UpcomingStarts.tsx
- src/pages/reports/DailyReports.tsx
- src/pages/shift-planning/ShiftOverview.tsx
- supabase/functions/adversus-sync-v2/index.ts
- supabase/functions/adversus-webhook/index.ts
- supabase/functions/calculate-kpi-values/index.ts
- supabase/functions/check-compliance-reviews/index.ts
- supabase/functions/sync-adversus/index.ts
- supabase/functions/tv-dashboard-data/index.ts

### `ai_governance_roles` (1)
- src/pages/compliance/AiGovernance.tsx

### `ai_instruction_log` (2)
- src/pages/compliance/AiGovernance.tsx
- supabase/functions/send-ai-instruction-email/index.ts

### `ai_use_case_registry` (1)
- src/pages/compliance/AiGovernance.tsx

### `amo_amr_elections` (2)
- src/pages/amo/AmoDashboard.tsx
- src/pages/amo/AmoOrganisation.tsx

### `amo_annual_discussions` (2)
- src/pages/amo/AmoAnnualDiscussion.tsx
- src/pages/amo/AmoDashboard.tsx

### `amo_apv` (3)
- src/pages/amo/AmoApv.tsx
- src/pages/amo/AmoDashboard.tsx
- supabase/functions/check-compliance-reviews/index.ts

### `amo_audit_log` (1)
- src/pages/amo/AmoAuditLog.tsx

### `amo_compliance_rules` (1)
- src/pages/amo/AmoSettings.tsx

### `amo_documents` (3)
- src/pages/amo/AmoDashboard.tsx
- src/pages/amo/AmoDocuments.tsx
- supabase/functions/check-compliance-reviews/index.ts

### `amo_kemi_apv` (2)
- src/pages/amo/AmoDashboard.tsx
- src/pages/amo/AmoKemiApv.tsx

### `amo_meetings` (2)
- src/pages/amo/AmoDashboard.tsx
- src/pages/amo/AmoMeetings.tsx

### `amo_members` (4)
- src/pages/amo/AmoDashboard.tsx
- src/pages/amo/AmoOrganisation.tsx
- src/pages/amo/AmoTasks.tsx
- src/pages/amo/AmoTraining.tsx

### `amo_tasks` (3)
- src/pages/amo/AmoDashboard.tsx
- src/pages/amo/AmoTasks.tsx
- supabase/functions/check-compliance-reviews/index.ts

### `amo_training_courses` (2)
- src/pages/amo/AmoDashboard.tsx
- src/pages/amo/AmoTraining.tsx

### `amo_workplaces` (2)
- src/pages/amo/AmoApv.tsx
- src/pages/amo/AmoOrganisation.tsx

### `api_integrations` (2)
- src/components/adversus/CphAdversusApiTab.tsx
- src/pages/Settings.tsx

### `applications` (8)
- supabase/functions/auto-segment-candidate/index.ts
- supabase/functions/gdpr-data-cleanup/index.ts
- supabase/functions/get-public-availability/index.ts
- supabase/functions/process-booking-flow/index.ts
- supabase/functions/public-book-candidate/index.ts
- supabase/functions/receive-sms/index.ts
- supabase/functions/send-recruitment-sms/index.ts
- supabase/functions/unsubscribe-candidate/index.ts

### `audit_logs` (1)
- supabase/functions/gdpr-data-cleanup/index.ts

### `billing_manual_expenses` (1)
- src/components/billing/ExpenseReportTab.tsx

### `booking` (20)
- src/components/billing/ExpenseReportTab.tsx
- src/components/billing/SupplierReportTab.tsx
- src/components/salary/ClientDBDailyBreakdown.tsx
- src/components/salary/ClientDBTab.tsx
- src/components/vagt-flow/BookingsLast30DaysChart.tsx
- src/components/vagt-flow/CapacityPanel.tsx
- src/components/vagt-flow/EditBookingDialog.tsx
- src/hooks/useBookingHotels.ts
- src/pages/reports/LocationReportTab.tsx
- src/pages/reports/RevenueByClient.tsx
- src/pages/vagt-flow/Billing.tsx
- src/pages/vagt-flow/BookWeekContent.tsx
- src/pages/vagt-flow/Bookings.tsx
- src/pages/vagt-flow/BookingsContent.tsx
- src/pages/vagt-flow/Index.tsx
- src/pages/vagt-flow/LocationHistoryContent.tsx
- src/pages/vagt-flow/LocationProfitabilityContent.tsx
- src/pages/vagt-flow/MarketsContent.tsx
- src/pages/vagt-flow/SalesRegistration.tsx
- supabase/functions/parse-expense-formula/index.ts

### `booking_assignment` (12)
- src/components/vagt-flow/AddEmployeeDialog.tsx
- src/components/vagt-flow/EditBookingDialog.tsx
- src/hooks/useFmBookingConflicts.ts
- src/hooks/useTeamGoalForecast.ts
- src/pages/MyProfile.tsx
- src/pages/vagt-flow/Bookings.tsx
- src/pages/vagt-flow/BookingsContent.tsx
- src/pages/vagt-flow/MarketsContent.tsx
- src/pages/vagt-flow/MyBookingSchedule.tsx
- src/pages/vagt-flow/SalesRegistration.tsx
- src/pages/vagt-flow/VagtplanFMContent.tsx
- supabase/functions/parse-expense-formula/index.ts

### `booking_diet` (7)
- src/components/my-profile/PayrollDayByDay.tsx
- src/components/vagt-flow/EditBookingDialog.tsx
- src/hooks/useSellerSalariesCached.ts
- src/pages/vagt-flow/BookingsContent.tsx
- src/pages/vagt-flow/LocationHistoryContent.tsx
- src/pages/vagt-flow/LocationProfitabilityContent.tsx
- src/pages/vagt-flow/MyBookingSchedule.tsx

### `booking_flow_enrollments` (11)
- src/components/recruitment/BookingCalendarTab.tsx
- src/components/recruitment/BookingFlowConversationsTab.tsx
- src/components/recruitment/RecruitmentKpiBar.tsx
- src/pages/recruitment/BookingFlow.tsx
- src/pages/recruitment/BookingFlowEngagement.tsx
- supabase/functions/auto-segment-candidate/index.ts
- supabase/functions/process-booking-flow/index.ts
- supabase/functions/public-book-candidate/index.ts
- supabase/functions/receive-sms/index.ts
- supabase/functions/regenerate-flow-touchpoints/index.ts
- supabase/functions/unsubscribe-candidate/index.ts

### `booking_flow_steps` (6)
- src/components/recruitment/FlowTemplatesTab.tsx
- src/pages/recruitment/BookingFlow.tsx
- supabase/functions/auto-segment-candidate/index.ts
- supabase/functions/process-booking-flow/index.ts
- supabase/functions/public-book-candidate/index.ts
- supabase/functions/regenerate-flow-touchpoints/index.ts

### `booking_flow_touchpoints` (12)
- src/components/recruitment/BookingCalendarTab.tsx
- src/components/recruitment/BookingFlowConversationsTab.tsx
- src/components/recruitment/RecruitmentKpiBar.tsx
- src/hooks/useCalendarBooking.ts
- src/pages/recruitment/BookingFlow.tsx
- src/pages/recruitment/BookingFlowEngagement.tsx
- supabase/functions/auto-segment-candidate/index.ts
- supabase/functions/process-booking-flow/index.ts
- supabase/functions/public-book-candidate/index.ts
- supabase/functions/receive-sms/index.ts
- supabase/functions/regenerate-flow-touchpoints/index.ts
- supabase/functions/unsubscribe-candidate/index.ts

### `booking_hotel` (6)
- src/components/billing/ExpenseReportTab.tsx
- src/components/billing/HotelExpensesTab.tsx
- src/hooks/useBookingHotels.ts
- src/pages/vagt-flow/LocationHistoryContent.tsx
- src/pages/vagt-flow/LocationProfitabilityContent.tsx
- src/pages/vagt-flow/MyBookingSchedule.tsx

### `booking_notification_recipients` (4)
- src/components/recruitment/BookingNotificationsTab.tsx
- src/pages/recruitment/BookingFlow.tsx
- supabase/functions/public-book-candidate/index.ts
- supabase/functions/unsubscribe-candidate/index.ts

### `booking_page_config` (2)
- src/components/recruitment/BookingPreviewTab.tsx
- src/pages/recruitment/PublicCandidateBooking.tsx

### `booking_page_content` (4)
- src/components/recruitment/BookingPagesTab.tsx
- src/pages/recruitment/PublicCandidateBooking.tsx
- src/pages/recruitment/PublicUnsubscribe.tsx
- supabase/functions/unsubscribe-candidate/index.ts

### `booking_settings` (2)
- src/components/recruitment/BookingSettingsTab.tsx
- supabase/functions/get-public-availability/index.ts

### `booking_vehicle` (4)
- src/components/vagt-flow/EditBookingDialog.tsx
- src/pages/vagt-flow/BookingsContent.tsx
- src/pages/vagt-flow/MarketsContent.tsx
- src/pages/vagt-flow/MyBookingSchedule.tsx

### `call_records` (11)
- src/components/calls/CallModal.tsx
- src/components/layout/AppSidebar.tsx
- src/components/recruitment/CandidateCallLogs.tsx
- src/pages/recruitment/CandidateDetail.tsx
- src/pages/recruitment/Candidates.tsx
- src/pages/recruitment/Messages.tsx
- supabase/functions/end-call/index.ts
- supabase/functions/gdpr-data-cleanup/index.ts
- supabase/functions/incoming-call/index.ts
- supabase/functions/initiate-call/index.ts
- supabase/functions/twilio-webhook/index.ts

### `campaign_product_mappings` (1)
- supabase/functions/sync-adversus/index.ts

### `campaign_retention_policies` (2)
- src/pages/compliance/RetentionPolicies.tsx
- supabase/functions/gdpr-data-cleanup/index.ts

### `cancellation_imports` (5)
- src/components/cancellations/ApprovalQueueTab.tsx
- src/components/cancellations/CancellationHistoryTable.tsx
- src/components/cancellations/MatchErrorsSubTab.tsx
- src/components/cancellations/SellerMappingTab.tsx
- src/components/cancellations/UploadCancellationsTab.tsx

### `cancellation_product_conditions` (4)
- src/components/cancellations/ApprovalQueueTab.tsx
- src/components/cancellations/SellerMappingTab.tsx
- src/components/cancellations/UploadCancellationsTab.tsx
- src/components/mg-test/ProductMergeDialog.tsx

### `cancellation_product_mappings` (4)
- src/components/cancellations/ApprovalQueueTab.tsx
- src/components/cancellations/ProductAutoMatch.tsx
- src/components/cancellations/UploadCancellationsTab.tsx
- src/components/mg-test/ProductMergeDialog.tsx

### `cancellation_queue` (10)
- src/components/cancellations/ApprovalQueueTab.tsx
- src/components/cancellations/ApprovedTab.tsx
- src/components/cancellations/CancellationHistoryTable.tsx
- src/components/cancellations/LocateSaleDialog.tsx
- src/components/cancellations/MatchErrorsSubTab.tsx
- src/components/cancellations/SellerMappingTab.tsx
- src/components/cancellations/UnmatchedTab.tsx
- src/components/cancellations/UploadCancellationsTab.tsx
- src/hooks/useSellerSalariesCached.ts
- supabase/functions/gdpr-data-cleanup/index.ts

### `cancellation_seller_mappings` (3)
- src/components/cancellations/MatchErrorsSubTab.tsx
- src/components/cancellations/SellerMappingTab.tsx
- src/components/cancellations/UploadCancellationsTab.tsx

### `cancellation_upload_configs` (3)
- src/components/cancellations/ApprovalQueueTab.tsx
- src/components/cancellations/MatchErrorsSubTab.tsx
- src/components/cancellations/UploadCancellationsTab.tsx

### `candidate_sources` (1)
- src/hooks/useCandidateSources.ts

### `candidates` (34)
- src/components/calls/SoftphoneWidget.tsx
- src/components/personnel/AddMemberDialog.tsx
- src/components/recruitment/BookingCalendarTab.tsx
- src/components/recruitment/BookingPreviewTab.tsx
- src/components/recruitment/BookingSettingsTab.tsx
- src/components/recruitment/CandidateCard.tsx
- src/components/recruitment/CandidateDetailDialog.tsx
- src/components/recruitment/NewCandidateDialog.tsx
- src/components/recruitment/RecruitmentKpiBar.tsx
- src/hooks/useCalendarBooking.ts
- src/hooks/useDashboardKpiData.ts
- src/hooks/useReferrals.ts
- src/pages/CompanyOverview.tsx
- src/pages/dashboards/CphSalesDashboard.tsx
- src/pages/personnel/UpcomingStarts.tsx
- src/pages/recruitment/BookingFlow.tsx
- src/pages/recruitment/BookingFlowEngagement.tsx
- src/pages/recruitment/CandidateDetail.tsx
- src/pages/recruitment/Candidates.tsx
- src/pages/recruitment/Messages.tsx
- src/pages/recruitment/PublicUnsubscribe.tsx
- src/pages/recruitment/RecruitmentDashboard.tsx
- src/pages/recruitment/UpcomingHires.tsx
- src/pages/recruitment/UpcomingInterviews.tsx
- src/pages/recruitment/Winback.tsx
- supabase/functions/auto-segment-candidate/index.ts
- supabase/functions/gdpr-data-cleanup/index.ts
- supabase/functions/get-public-availability/index.ts
- supabase/functions/incoming-call/index.ts
- supabase/functions/public-book-candidate/index.ts
- supabase/functions/receive-sms/index.ts
- supabase/functions/twilio-webhook/index.ts
- supabase/functions/unsubscribe-candidate/index.ts
- supabase/functions/zapier-webhook/index.ts

### `car_quiz_completions` (1)
- src/hooks/useCarQuiz.ts

### `car_quiz_submissions` (1)
- src/hooks/useCarQuiz.ts

### `career_wishes` (3)
- src/components/profile/CareerWishesTabContent.tsx
- src/pages/CareerWishes.tsx
- src/pages/CareerWishesOverview.tsx

### `chat_conversation_members` (1)
- src/hooks/useChat.ts

### `chat_conversations` (1)
- src/hooks/useChat.ts

### `chat_message_reactions` (1)
- src/hooks/useChat.ts

### `chat_message_read_receipts` (1)
- src/hooks/useChat.ts

### `chat_messages` (1)
- src/hooks/useChat.ts

### `client_adjustment_percents` (2)
- src/components/salary/ClientDBTab.tsx
- src/pages/reports/RevenueByClient.tsx

### `client_campaigns` (30)
- src/components/cancellations/ApprovalQueueTab.tsx
- src/components/cancellations/DuplicatesTab.tsx
- src/components/cancellations/ManualCancellationsTab.tsx
- src/components/cancellations/MatchErrorsSubTab.tsx
- src/components/cancellations/SellerMappingTab.tsx
- src/components/cancellations/UnmatchedTab.tsx
- src/components/cancellations/UploadCancellationsTab.tsx
- src/components/dashboard/RelatelProductsBoard.tsx
- src/components/mg-test/CommissionRatesTab.tsx
- src/components/mg-test/ProductMergeDialog.tsx
- src/components/mg-test/ProductPricingRulesDialog.tsx
- src/components/vagt-flow/EditBookingDialog.tsx
- src/hooks/useDashboardKpiData.ts
- src/hooks/useHasImmediatePaymentSales.ts
- src/hooks/useTeamGoalForecast.ts
- src/pages/ImmediatePaymentASE.tsx
- src/pages/MgTest.tsx
- src/pages/UnitedDashboard.tsx
- src/pages/compliance/RetentionPolicies.tsx
- src/pages/dashboards/CphSalesDashboard.tsx
- src/pages/economic/SalesValidation.tsx
- src/pages/reports/DailyReports.tsx
- src/pages/reports/ReportsAdmin.tsx
- src/pages/vagt-flow/LocationDetail.tsx
- src/pages/vagt-flow/SalesRegistration.tsx
- supabase/functions/calculate-kpi-incremental/index.ts
- supabase/functions/calculate-kpi-values/index.ts
- supabase/functions/import-products/index.ts
- supabase/functions/snapshot-payroll-period/index.ts
- supabase/functions/tv-dashboard-data/index.ts

### `client_monthly_goals` (3)
- src/hooks/useCelebrationData.ts
- src/hooks/useDashboardKpiData.ts
- supabase/functions/tv-dashboard-data/index.ts

### `clients` (28)
- src/components/employees/TeamAssignEmployeesSubTab.tsx
- src/components/employees/TeamTimeClockTab.tsx
- src/components/employees/TeamsTab.tsx
- src/components/forecast/CreateForecastDialog.tsx
- src/components/kpi/KpiLiveTest.tsx
- src/components/mg-test/CommissionRatesTab.tsx
- src/components/profile/CareerWishesTabContent.tsx
- src/components/salary/ClientDBTab.tsx
- src/hooks/useDashboardSalesData.ts
- src/pages/CareerWishes.tsx
- src/pages/EmployeeDetail.tsx
- src/pages/LiveStats.tsx
- src/pages/MgTest.tsx
- src/pages/dashboards/CphSalesDashboard.tsx
- src/pages/dashboards/SalesOverviewAll.tsx
- src/pages/economic/EconomicRevenueMatch.tsx
- src/pages/economic/SalesValidation.tsx
- src/pages/reports/DailyReports.tsx
- src/pages/reports/ReportsAdmin.tsx
- src/pages/reports/RevenueByClient.tsx
- src/pages/salary/Cancellations.tsx
- src/pages/vagt-flow/EditSalesRegistrations.tsx
- src/pages/vagt-flow/FieldmarketingDashboard.tsx
- supabase/functions/calculate-kpi-incremental/index.ts
- supabase/functions/calculate-kpi-values/index.ts
- supabase/functions/import-products/index.ts
- supabase/functions/snapshot-payroll-period/index.ts
- supabase/functions/tv-dashboard-data/index.ts

### `closing_shifts` (2)
- src/pages/ClosingShifts.tsx
- supabase/functions/send-closing-reminder/index.ts

### `coaching_feedback` (1)
- src/hooks/useCoachingTemplates.ts

### `coaching_feedback_types` (1)
- src/hooks/useCoachingTemplates.ts

### `coaching_objections` (1)
- src/hooks/useCoachingTemplates.ts

### `coaching_templates` (1)
- src/hooks/useCoachingTemplates.ts

### `code_of_conduct_attempts` (2)
- src/hooks/useCodeOfConduct.ts
- src/pages/CodeOfConductAdmin.tsx

### `code_of_conduct_completions` (3)
- src/hooks/useCodeOfConduct.ts
- src/pages/CodeOfConductAdmin.tsx
- supabase/functions/send-code-of-conduct-reminder/index.ts

### `code_of_conduct_reminders` (3)
- src/hooks/useCodeOfConduct.ts
- src/hooks/useCodeOfConductReminder.ts
- src/pages/CodeOfConductAdmin.tsx

### `cohort_members` (5)
- src/components/personnel/AddMemberDialog.tsx
- src/components/personnel/EditMemberClientDialog.tsx
- src/pages/dashboards/CphSalesDashboard.tsx
- src/pages/personnel/UpcomingStarts.tsx
- src/pages/recruitment/CandidateDetail.tsx

### `commission_transactions` (1)
- supabase/functions/sync-adversus/index.ts

### `communication_logs` (17)
- src/components/employees/SendEmployeeSmsDialog.tsx
- src/components/layout/AppSidebar.tsx
- src/components/recruitment/CandidateCallLogs.tsx
- src/components/recruitment/CandidateChatHistory.tsx
- src/components/recruitment/CandidateDetailDialog.tsx
- src/components/recruitment/SendSmsDialog.tsx
- src/hooks/useEmployeeSmsConversations.ts
- src/pages/recruitment/BookingFlowEngagement.tsx
- src/pages/recruitment/CandidateDetail.tsx
- src/pages/recruitment/Candidates.tsx
- src/pages/recruitment/Messages.tsx
- src/pages/recruitment/RecruitmentDashboard.tsx
- supabase/functions/gdpr-data-cleanup/index.ts
- supabase/functions/gdpr-process-deletion/index.ts
- supabase/functions/receive-sms/index.ts
- supabase/functions/send-employee-sms/index.ts
- supabase/functions/send-recruitment-sms/index.ts

### `company_events` (2)
- src/components/home/EditEventDialog.tsx
- src/pages/Home.tsx

### `compliance_notification_recipients` (2)
- src/pages/compliance/ComplianceNotifications.tsx
- supabase/functions/check-compliance-reviews/index.ts

### `contract_access_log` (2)
- src/hooks/useLogContractAccess.ts
- src/pages/compliance/ContractAccessLog.tsx

### `contract_signatures` (4)
- src/components/contracts/SendContractDialog.tsx
- src/pages/ContractSign.tsx
- src/pages/Contracts.tsx
- src/pages/EmployeeDetail.tsx

### `contract_templates` (2)
- src/components/contracts/SendContractDialog.tsx
- src/pages/Contracts.tsx

### `contracts` (16)
- src/components/contracts/SendContractDialog.tsx
- src/components/employees/StaffEmployeesTab.tsx
- src/components/layout/AppSidebar.tsx
- src/hooks/usePendingContractLock.ts
- src/hooks/useRejectedContractLock.ts
- src/pages/ContractSign.tsx
- src/pages/Contracts.tsx
- src/pages/EmployeeDetail.tsx
- src/pages/EmployeeMasterData.tsx
- src/pages/MyContracts.tsx
- src/pages/MyProfile.tsx
- src/pages/compliance/ContractAccessLog.tsx
- supabase/functions/generate-contract-pdf/index.ts
- supabase/functions/send-contract-reminders/index.ts
- supabase/functions/send-contract-signed-confirmation/index.ts
- supabase/functions/sync-contracts-to-sharepoint/index.ts

### `customer_inquiries` (3)
- src/components/home/CustomerInquiryInbox.tsx
- supabase/functions/customer-inquiry-webhook/index.ts
- supabase/functions/gdpr-data-cleanup/index.ts

### `daily_bonus_payouts` (4)
- src/components/my-profile/PayrollDayByDay.tsx
- src/hooks/useSellerSalariesCached.ts
- src/pages/shift-planning/ShiftOverview.tsx
- src/pages/vagt-flow/VagtplanFMContent.tsx

### `danish_holiday` (3)
- src/hooks/useShiftPlanning.ts
- src/pages/MyGoals.tsx
- src/pages/MyProfile.tsx

### `dashboard_kpis` (4)
- src/hooks/useDashboardKpiData.ts
- src/hooks/useKpiFormulas.ts
- src/pages/LiveStats.tsx
- src/pages/dashboards/DashboardSettings.tsx

### `data_field_definitions` (5)
- src/components/mg-test/FieldDefinitionDialog.tsx
- src/components/mg-test/FieldDefinitionsManager.tsx
- src/components/mg-test/IntegrationMappingEditor.tsx
- src/hooks/useNormalizedSalesData.ts
- supabase/functions/gdpr-data-cleanup/index.ts

### `data_retention_policies` (2)
- src/pages/compliance/RetentionPolicies.tsx
- supabase/functions/gdpr-data-cleanup/index.ts

### `deactivation_reminder_config` (5)
- src/components/employees/StaffEmployeesTab.tsx
- src/pages/ClosingShifts.tsx
- src/pages/EmployeeMasterData.tsx
- supabase/functions/send-deactivation-followups/index.ts
- supabase/functions/send-deactivation-reminder/index.ts

### `deactivation_reminders_sent` (2)
- supabase/functions/send-deactivation-followups/index.ts
- supabase/functions/send-deactivation-reminder/index.ts

### `dialer_calls` (8)
- src/components/api-overview/ApiDataOverview.tsx
- src/components/api-overview/EventDataTable.tsx
- src/components/calls-analytics/CallsAnalytics.tsx
- src/components/home/HeadToHeadComparison.tsx
- src/components/settings/DialerIntegrations.tsx
- src/hooks/useDashboardKpiData.ts
- src/hooks/useKpiTest.ts
- supabase/functions/tv-dashboard-data/index.ts

### `dialer_integrations` (18)
- src/components/mg-test/IntegrationMappingEditor.tsx
- src/components/settings/DialerIntegrations.tsx
- src/pages/ClientSalesOverview.tsx
- src/pages/SystemStability.tsx
- supabase/functions/adversus-create-webhook/index.ts
- supabase/functions/adversus-diagnostics/index.ts
- supabase/functions/adversus-lead-check/index.ts
- supabase/functions/adversus-manage-webhooks/index.ts
- supabase/functions/client-sales-overview/index.ts
- supabase/functions/dialer-webhook/index.ts
- supabase/functions/enreach-diagnostics/index.ts
- supabase/functions/enreach-manage-webhooks/index.ts
- supabase/functions/enrichment-healer/index.ts
- supabase/functions/integration-engine/index.ts
- supabase/functions/probe-enreach-integration/index.ts
- supabase/functions/sync-health-check/index.ts
- supabase/functions/tdc-opp-backfill/index.ts
- supabase/functions/update-cron-schedule/index.ts

### `economic_baseline_exclusions` (1)
- src/hooks/useEconomicData.ts

### `economic_budget_lines` (1)
- src/hooks/useEconomicData.ts

### `economic_client_mapping` (1)
- src/pages/economic/EconomicRevenueMatch.tsx

### `economic_events` (1)
- supabase/functions/economic-webhook/index.ts

### `economic_fordelingsregler` (2)
- src/hooks/useEconomicData.ts
- src/pages/economic/EconomicMapping.tsx

### `economic_imports` (2)
- src/pages/admin/EconomicUpload.tsx
- supabase/functions/import-economic-zip/index.ts

### `economic_kategorier` (1)
- src/hooks/useEconomicData.ts

### `economic_konto_mapping` (1)
- src/hooks/useEconomicData.ts

### `economic_kontoplan` (2)
- src/hooks/useEconomicData.ts
- supabase/functions/import-economic-zip/index.ts

### `economic_posteringer` (2)
- src/pages/economic/EconomicRevenueMatch.tsx
- supabase/functions/import-economic-zip/index.ts

### `email_templates` (4)
- src/components/recruitment/CreateEmailTemplateDialog.tsx
- src/components/recruitment/SendEmailDialog.tsx
- src/pages/EmailTemplates.tsx
- src/pages/recruitment/EmailTemplates.tsx

### `employee` (4)
- src/pages/EmployeeDetail.tsx
- src/pages/MgTest.tsx
- src/pages/MyProfile.tsx
- src/pages/vagt-flow/Index.tsx

### `employee_absence` (3)
- src/hooks/useTimeOffRequests.ts
- src/pages/EmployeeDetail.tsx
- src/pages/MyProfile.tsx

### `employee_agent_mapping` (29)
- src/components/cancellations/LocateSaleDialog.tsx
- src/components/cancellations/MatchErrorsSubTab.tsx
- src/components/cancellations/UploadCancellationsTab.tsx
- src/components/employee/EmployeeCommissionHistory.tsx
- src/components/employees/DialerMappingTab.tsx
- src/components/home/HeadToHeadComparison.tsx
- src/components/my-profile/PayrollDayByDay.tsx
- src/components/salary/CombinedSalaryTab.tsx
- src/components/shift-planning/MissingShiftsAlert.tsx
- src/hooks/useAgentNameResolver.ts
- src/hooks/useClientForecast.ts
- src/hooks/useDashboardSalesData.ts
- src/hooks/useHasImmediatePaymentSales.ts
- src/hooks/usePersonalSalesStats.ts
- src/hooks/usePreviousPeriodComparison.ts
- src/hooks/useRecognitionKpis.ts
- src/hooks/useSalesAggregatesExtended.ts
- src/hooks/useSellerSalariesCached.ts
- src/hooks/useTeamGoalForecast.ts
- src/pages/ImmediatePaymentASE.tsx
- src/pages/MyProfile.tsx
- src/pages/UnitedDashboard.tsx
- src/pages/personnel/UpcomingStarts.tsx
- src/pages/reports/DailyReports.tsx
- src/pages/shift-planning/ShiftOverview.tsx
- supabase/functions/calculate-kpi-incremental/index.ts
- supabase/functions/calculate-kpi-values/index.ts
- supabase/functions/snapshot-payroll-period/index.ts
- supabase/functions/tv-dashboard-data/index.ts

### `employee_basic_info` (4)
- src/components/home/HeadToHeadComparison.tsx
- src/hooks/useChat.ts
- src/pages/HeadToHead.tsx
- src/pages/reports/DailyReports.tsx

### `employee_client_assignments` (3)
- src/components/shift-planning/EditTimeStampDialog.tsx
- src/hooks/useEmployeeClientAssignments.ts
- src/hooks/useTimeStamps.ts

### `employee_client_change_log` (2)
- src/components/employees/TeamAssignEmployeesSubTab.tsx
- src/hooks/useEmployeeClientAssignments.ts

### `employee_dashboards` (1)
- src/hooks/useEmployeeDashboards.ts

### `employee_identity` (2)
- src/components/api-overview/EventDataTable.tsx
- src/pages/MgTest.tsx

### `employee_invitations` (2)
- supabase/functions/complete-employee-registration/index.ts
- supabase/functions/send-employee-invitation/index.ts

### `employee_master_data` (163)
- src/components/absence/PendingAbsencePopup.tsx
- src/components/calls/SoftphoneWidget.tsx
- src/components/cancellations/ApprovalQueueTab.tsx
- src/components/cancellations/ApprovedTab.tsx
- src/components/cancellations/LocateSaleDialog.tsx
- src/components/cancellations/MatchErrorsSubTab.tsx
- src/components/cancellations/SellerMappingTab.tsx
- src/components/cancellations/UploadCancellationsTab.tsx
- src/components/company-overview/ChurnCalculator.tsx
- src/components/company-overview/ChurnTrendChart.tsx
- src/components/company-overview/ChurnTrendChart30Days.tsx
- src/components/company-overview/ChurnTrendChart60DaysFiltered.tsx
- src/components/company-overview/ChurnTrendChartCombined.tsx
- src/components/company-overview/HistoricalTenureStats.tsx
- src/components/company-overview/NewHireChurnKpi.tsx
- src/components/company-overview/TeamAvgTenureChart.tsx
- src/components/dashboard/ClientDashboard.tsx
- src/components/employee/EmployeeProfileDialog.tsx
- src/components/employees/DialerMappingTab.tsx
- src/components/employees/EmployeeExcelImport.tsx
- src/components/employees/EmployeeFormDialog.tsx
- src/components/employees/PositionsTab.tsx
- src/components/employees/StaffEmployeesTab.tsx
- src/components/employees/TeamStandardShifts.tsx
- src/components/employees/TeamTimeClockTab.tsx
- src/components/employees/TeamsTab.tsx
- src/components/home/HeadToHeadComparison.tsx
- src/components/kpi/FormulaLiveTest.tsx
- src/components/kpi/KpiLiveTest.tsx
- src/components/layout/AppSidebar.tsx
- src/components/layout/CompleteProfileBanner.tsx
- src/components/messages/ChatView.tsx
- src/components/my-profile/PayrollDayByDay.tsx
- src/components/personnel/CreateCohortDialog.tsx
- src/components/recruitment/CreateReferralDialog.tsx
- src/components/salary/AddPersonnelDialog.tsx
- src/components/salary/CombinedSalaryTab.tsx
- src/components/salary/DBOverviewTab.tsx
- src/components/salary/NewEmployeesTab.tsx
- src/components/salary/SalaryDashboardKPIs.tsx
- src/components/salary/SalaryTypesTab.tsx
- src/components/vagt-flow/CapacityPanel.tsx
- src/contexts/SessionTimeoutContext.tsx
- src/hooks/useAgentNameResolver.ts
- src/hooks/useAssistantHoursCalculation.ts
- src/hooks/useAuth.tsx
- src/hooks/useCarQuiz.ts
- src/hooks/useCodeOfConduct.ts
- src/hooks/useCodeOfConductReminder.ts
- src/hooks/useDashboardKpiData.ts
- src/hooks/useDashboardSalesData.ts
- src/hooks/useEffectiveHourlyRate.ts
- src/hooks/useEmployeeAvatars.ts
- src/hooks/useEmployeeDashboards.ts
- src/hooks/useEmployeeSmsConversations.ts
- src/hooks/useExtraWork.ts
- src/hooks/useFieldmarketingEmployee.ts
- src/hooks/useFieldmarketingSales.ts
- src/hooks/useGoalLock.ts
- src/hooks/useHasImmediatePaymentSales.ts
- src/hooks/useKpiTest.ts
- src/hooks/useLeagueActiveData.ts
- src/hooks/useLeagueData.ts
- src/hooks/useLogContractAccess.ts
- src/hooks/useMfa.ts
- src/hooks/useOnboarding.ts
- src/hooks/usePersonalSalesStats.ts
- src/hooks/usePositionPermissions.ts
- src/hooks/usePreviousPeriodComparison.ts
- src/hooks/usePulseSurvey.ts
- src/hooks/useReferrals.ts
- src/hooks/useRejectedContractLock.ts
- src/hooks/useSellerSalariesCached.ts
- src/hooks/useShiftPlanning.ts
- src/hooks/useShiftResolution.ts
- src/hooks/useSystemRoles.ts
- src/hooks/useTeamDashboardPermissions.ts
- src/hooks/useTeamGoalForecast.ts
- src/hooks/useTimeStamps.ts
- src/hooks/useUnifiedPermissions.ts
- src/hooks/useVagtEmployee.ts
- src/pages/CarQuizAdmin.tsx
- src/pages/CareerWishes.tsx
- src/pages/ClosingShifts.tsx
- src/pages/CodeOfConductAdmin.tsx
- src/pages/CompanyOverview.tsx
- src/pages/ContractSign.tsx
- src/pages/EmployeeDetail.tsx
- src/pages/EmployeeMasterData.tsx
- src/pages/ExcelFieldMatcher.tsx
- src/pages/ExtraWork.tsx
- src/pages/ExtraWorkAdmin.tsx
- src/pages/HeadToHead.tsx
- src/pages/Home.tsx
- src/pages/ImmediatePaymentASE.tsx
- src/pages/LiveStats.tsx
- src/pages/MyContracts.tsx
- src/pages/MyGoals.tsx
- src/pages/MyProfile.tsx
- src/pages/OnboardingAnalyse.tsx
- src/pages/PulseSurvey.tsx
- src/pages/RolePreview.tsx
- src/pages/SalarySchemes.tsx
- src/pages/SystemFeedback.tsx
- src/pages/Teams.tsx
- src/pages/admin/SecurityDashboard.tsx
- src/pages/compliance/AiGovernance.tsx
- src/pages/compliance/ContractAccessLog.tsx
- src/pages/compliance/EmployeePrivacy.tsx
- src/pages/compliance/InternalProcesses.tsx
- src/pages/compliance/SensitiveAccessLog.tsx
- src/pages/dashboards/CphSalesDashboard.tsx
- src/pages/dashboards/DashboardHome.tsx
- src/pages/dashboards/SalesOverviewAll.tsx
- src/pages/onboarding/LeaderOnboardingView.tsx
- src/pages/personnel/UpcomingStarts.tsx
- src/pages/recruitment/CandidateDetail.tsx
- src/pages/recruitment/Referrals.tsx
- src/pages/reports/DailyReports.tsx
- src/pages/reports/ReportsAdmin.tsx
- src/pages/shift-planning/ShiftOverview.tsx
- src/pages/vagt-flow/Bookings.tsx
- src/pages/vagt-flow/BookingsContent.tsx
- src/pages/vagt-flow/EditSalesRegistrations.tsx
- src/pages/vagt-flow/FieldmarketingDashboard.tsx
- src/pages/vagt-flow/FmChecklistContent.tsx
- src/pages/vagt-flow/MarketsContent.tsx
- src/pages/vagt-flow/MyBookingSchedule.tsx
- src/pages/vagt-flow/SalesRegistration.tsx
- src/routes/guards.tsx
- supabase/functions/batch-set-fieldmarketing-passwords/index.ts
- supabase/functions/calculate-kpi-values/index.ts
- supabase/functions/calculate-leaderboard-incremental/index.ts
- supabase/functions/check-account-locked/index.ts
- supabase/functions/check-mfa-exempt/index.ts
- supabase/functions/cleanup-inactive-employees/index.ts
- supabase/functions/complete-employee-registration/index.ts
- supabase/functions/create-employee-user/index.ts
- supabase/functions/force-password-reset/index.ts
- supabase/functions/gdpr-data-cleanup/index.ts
- supabase/functions/gdpr-export-data/index.ts
- supabase/functions/gdpr-process-deletion/index.ts
- supabase/functions/initiate-call/index.ts
- supabase/functions/initiate-password-reset/index.ts
- supabase/functions/log-failed-login/index.ts
- supabase/functions/notify-referral-received/index.ts
- supabase/functions/notify-vehicle-returned/index.ts
- supabase/functions/parse-expense-formula/index.ts
- supabase/functions/probe-enreach-integration/index.ts
- supabase/functions/reset-user-mfa/index.ts
- supabase/functions/send-ai-instruction-email/index.ts
- supabase/functions/send-code-of-conduct-reminder/index.ts
- supabase/functions/send-deactivation-followups/index.ts
- supabase/functions/send-employee-invitation/index.ts
- supabase/functions/send-employee-sms/index.ts
- supabase/functions/send-weekend-cleanup/index.ts
- supabase/functions/set-user-password/index.ts
- supabase/functions/submit-employee-pulse-survey/index.ts
- supabase/functions/sync-contracts-to-sharepoint/index.ts
- supabase/functions/tv-dashboard-data/index.ts
- supabase/functions/tv-league-data/index.ts
- supabase/functions/twilio-access-token/index.ts
- supabase/functions/unlock-account/index.ts

### `employee_onboarding_progress` (1)
- src/hooks/useOnboarding.ts

### `employee_referral_lookup` (1)
- src/components/kpi/PublicLinksOverview.tsx

### `employee_referrals` (5)
- src/components/layout/AppSidebar.tsx
- src/components/recruitment/CreateReferralDialog.tsx
- src/hooks/useReferrals.ts
- src/pages/recruitment/RecruitmentDashboard.tsx
- supabase/functions/submit-referral/index.ts

### `employee_salary_schemes` (1)
- src/pages/SalarySchemes.tsx

### `employee_sales_achievements` (1)
- src/hooks/useSalesGamification.ts

### `employee_sales_goals` (5)
- src/components/layout/GoalLockOverlay.tsx
- src/components/my-profile/SalesGoalTracker.tsx
- src/hooks/useGoalLock.ts
- src/pages/Home.tsx
- supabase/functions/tv-dashboard-data/index.ts

### `employee_sales_levels` (1)
- src/hooks/useSalesGamification.ts

### `employee_sales_records` (1)
- src/hooks/useSalesGamification.ts

### `employee_sales_streaks` (2)
- src/hooks/useSalesGamification.ts
- supabase/functions/tv-league-data/index.ts

### `employee_standard_shifts` (15)
- src/components/employee/EmployeeCommissionHistory.tsx
- src/components/employees/TeamStandardShifts.tsx
- src/components/kpi/FormulaLiveTest.tsx
- src/components/profile/MyScheduleTabContent.tsx
- src/components/vagt-flow/AddEmployeeDialog.tsx
- src/components/vagt-flow/CapacityPanel.tsx
- src/components/vagt-flow/EditBookingDialog.tsx
- src/hooks/useAssistantHoursCalculation.ts
- src/hooks/useKpiTest.ts
- src/hooks/useShiftResolution.ts
- src/hooks/useStaffHoursCalculation.ts
- src/hooks/useTeamGoalForecast.ts
- src/pages/shift-planning/MySchedule.tsx
- src/pages/shift-planning/ShiftOverview.tsx
- src/pages/vagt-flow/VagtplanFMContent.tsx

### `employee_time_clocks` (7)
- src/hooks/useCpoRevenue.ts
- src/hooks/useEmployeeClientAssignments.ts
- src/hooks/useEmployeeTimeClocks.ts
- src/hooks/useHasActiveTimeClock.ts
- src/lib/resolveHoursSource.ts
- supabase/functions/calculate-kpi-values/index.ts
- supabase/functions/tv-dashboard-data/index.ts

### `event_attendees` (2)
- src/components/home/EventInvitationPopup.tsx
- src/pages/Home.tsx

### `event_invitation_views` (1)
- src/components/home/EventInvitationPopup.tsx

### `event_team_invitations` (3)
- src/components/home/EditEventDialog.tsx
- src/components/home/EventInvitationPopup.tsx
- src/pages/Home.tsx

### `extra_work` (1)
- src/hooks/useExtraWork.ts

### `failed_login_attempts` (2)
- src/pages/admin/SecurityDashboard.tsx
- supabase/functions/log-failed-login/index.ts

### `feature_flags` (3)
- src/hooks/useFeatureFlag.ts
- supabase/functions/calculate-kpi-values/index.ts
- supabase/functions/tv-dashboard-data/index.ts

### `fm_checklist_completions` (2)
- src/hooks/useFmChecklist.ts
- supabase/functions/send-checklist-daily-summary/index.ts

### `fm_checklist_email_config` (2)
- src/hooks/useFmChecklist.ts
- supabase/functions/send-checklist-daily-summary/index.ts

### `fm_checklist_email_recipients` (2)
- src/hooks/useFmChecklist.ts
- supabase/functions/send-checklist-daily-summary/index.ts

### `fm_checklist_templates` (2)
- src/hooks/useFmChecklist.ts
- supabase/functions/send-checklist-daily-summary/index.ts

### `forecast_settings` (1)
- src/hooks/useForecastSettings.ts

### `gdpr_cleanup_log` (3)
- src/pages/compliance/RetentionPolicies.tsx
- supabase/functions/gdpr-export-data/index.ts
- supabase/functions/gdpr-process-deletion/index.ts

### `gdpr_consents` (3)
- src/hooks/useGdpr.ts
- supabase/functions/gdpr-export-data/index.ts
- supabase/functions/gdpr-process-deletion/index.ts

### `gdpr_data_requests` (3)
- src/hooks/useGdpr.ts
- supabase/functions/gdpr-export-data/index.ts
- supabase/functions/gdpr-process-deletion/index.ts

### `h2h_challenges` (5)
- src/components/h2h/H2HMatchHistory.tsx
- src/components/h2h/H2HPerformanceDashboard.tsx
- src/components/h2h/H2HPlayerStats.tsx
- src/components/home/HeadToHeadComparison.tsx
- src/components/layout/AppSidebar.tsx

### `h2h_employee_stats` (3)
- src/components/h2h/H2HMatchHistory.tsx
- src/components/h2h/H2HPerformanceDashboard.tsx
- src/components/h2h/H2HPlayerStats.tsx

### `hidden_unmapped_agents` (1)
- src/components/employees/DialerMappingTab.tsx

### `historical_employment` (10)
- src/components/company-overview/ChurnCalculator.tsx
- src/components/company-overview/ChurnTrendChart.tsx
- src/components/company-overview/ChurnTrendChart30Days.tsx
- src/components/company-overview/ChurnTrendChart60DaysFiltered.tsx
- src/components/company-overview/ChurnTrendChartCombined.tsx
- src/components/company-overview/HistoricalTenureStats.tsx
- src/components/company-overview/NewHireChurnKpi.tsx
- src/components/company-overview/TeamAvgTenureChart.tsx
- src/pages/CompanyOverview.tsx
- src/pages/OnboardingAnalyse.tsx

### `hotel` (1)
- src/hooks/useBookingHotels.ts

### `integration_circuit_breaker` (1)
- supabase/functions/sync-health-check/index.ts

### `integration_debug_log` (1)
- src/hooks/useIntegrationDebugLog.ts

### `integration_field_mappings` (1)
- src/components/mg-test/IntegrationMappingEditor.tsx

### `integration_logs` (12)
- src/components/settings/IntegrationLogs.tsx
- src/components/system-stability/WebhookActivity.tsx
- src/pages/SystemStability.tsx
- supabase/functions/adversus-create-webhook/index.ts
- supabase/functions/adversus-manage-webhooks/index.ts
- supabase/functions/adversus-webhook/index.ts
- supabase/functions/dialer-webhook/index.ts
- supabase/functions/enreach-manage-webhooks/index.ts
- supabase/functions/enrichment-healer/index.ts
- supabase/functions/gdpr-data-cleanup/index.ts
- supabase/functions/sync-health-check/index.ts
- supabase/functions/tdc-opp-backfill/index.ts

### `integration_schedule_audit` (2)
- src/pages/SystemStability.tsx
- supabase/functions/update-cron-schedule/index.ts

### `integration_sync_runs` (3)
- src/pages/SystemStability.tsx
- supabase/functions/enrichment-healer/index.ts
- supabase/functions/sync-health-check/index.ts

### `job_positions` (16)
- src/components/employees/PositionsTab.tsx
- src/components/employees/StaffEmployeesTab.tsx
- src/components/employees/permissions/PermissionEditor.tsx
- src/components/employees/permissions/PermissionEditorV2.tsx
- src/contexts/SessionTimeoutContext.tsx
- src/hooks/useMfa.ts
- src/hooks/usePositionPermissions.ts
- src/hooks/useUnifiedPermissions.ts
- src/pages/EmployeeDetail.tsx
- src/pages/EmployeeMasterData.tsx
- src/pages/RolePreview.tsx
- src/pages/admin/SecurityDashboard.tsx
- src/routes/guards.tsx
- supabase/functions/calculate-kpi-values/index.ts
- supabase/functions/check-mfa-exempt/index.ts
- supabase/functions/create-employee-user/index.ts

### `kpi_cached_values` (10)
- src/components/salary/ClientDBTab.tsx
- src/hooks/useAggregatedClientCache.ts
- src/hooks/useDashboardKpiData.ts
- src/hooks/usePrecomputedKpi.ts
- src/pages/UnitedDashboard.tsx
- src/pages/dashboards/SalesOverviewAll.tsx
- supabase/functions/calculate-kpi-incremental/index.ts
- supabase/functions/calculate-kpi-values/index.ts
- supabase/functions/generate-dashboard-layout/index.ts
- supabase/functions/tv-dashboard-data/index.ts

### `kpi_definitions` (6)
- src/hooks/useAchievementTargets.ts
- src/hooks/useEffectiveHourlyRate.ts
- src/hooks/useGamificationConfig.ts
- src/hooks/useKpiDefinitions.ts
- src/hooks/usePerformanceThresholds.ts
- supabase/functions/calculate-kpi-values/index.ts

### `kpi_leaderboard_cache` (5)
- src/hooks/useAggregatedClientCache.ts
- src/hooks/useCachedLeaderboard.ts
- supabase/functions/calculate-kpi-values/index.ts
- supabase/functions/calculate-leaderboard-incremental/index.ts
- supabase/functions/tv-dashboard-data/index.ts

### `kpi_period_snapshots` (1)
- supabase/functions/snapshot-payroll-period/index.ts

### `lateness_record` (7)
- src/components/profile/MyScheduleTabContent.tsx
- src/hooks/useKpiTest.ts
- src/pages/EmployeeDetail.tsx
- src/pages/MyProfile.tsx
- src/pages/shift-planning/MySchedule.tsx
- src/pages/shift-planning/ShiftOverview.tsx
- src/pages/vagt-flow/VagtplanFMContent.tsx

### `league_enrollments` (2)
- src/hooks/useLeagueData.ts
- supabase/functions/league-calculate-standings/index.ts

### `league_qualification_standings` (5)
- src/hooks/useLeagueData.ts
- src/hooks/useLeaguePrizeData.ts
- supabase/functions/calculate-kpi-values/index.ts
- supabase/functions/league-calculate-standings/index.ts
- supabase/functions/tv-league-data/index.ts

### `league_round_standings` (4)
- src/hooks/useLeagueActiveData.ts
- src/hooks/useLeaguePrizeData.ts
- supabase/functions/league-process-round/index.ts
- supabase/functions/tv-league-data/index.ts

### `league_rounds` (5)
- src/hooks/useLeagueActiveData.ts
- src/hooks/useLeaguePrizeData.ts
- supabase/functions/calculate-kpi-values/index.ts
- supabase/functions/league-process-round/index.ts
- supabase/functions/tv-league-data/index.ts

### `league_season_standings` (5)
- src/hooks/useLeagueActiveData.ts
- src/hooks/useLeaguePrizeData.ts
- supabase/functions/calculate-kpi-values/index.ts
- supabase/functions/league-process-round/index.ts
- supabase/functions/tv-league-data/index.ts

### `league_seasons` (6)
- src/hooks/useLeagueData.ts
- src/hooks/useLeaguePrizeData.ts
- supabase/functions/calculate-kpi-values/index.ts
- supabase/functions/league-calculate-standings/index.ts
- supabase/functions/league-process-round/index.ts
- supabase/functions/tv-league-data/index.ts

### `location` (12)
- src/components/billing/SupplierReportTab.tsx
- src/components/vagt-flow/EditBookingDialog.tsx
- src/pages/reports/LocationReportTab.tsx
- src/pages/vagt-flow/BookWeekContent.tsx
- src/pages/vagt-flow/EditSalesRegistrations.tsx
- src/pages/vagt-flow/Index.tsx
- src/pages/vagt-flow/LocationDetail.tsx
- src/pages/vagt-flow/LocationHistoryContent.tsx
- src/pages/vagt-flow/Locations.tsx
- src/pages/vagt-flow/LocationsContent.tsx
- src/pages/vagt-flow/SalesRegistration.tsx
- supabase/functions/parse-expense-formula/index.ts

### `location_placements` (5)
- src/components/vagt-flow/EditBookingDialog.tsx
- src/pages/vagt-flow/BookWeekContent.tsx
- src/pages/vagt-flow/LocationDetail.tsx
- src/pages/vagt-flow/LocationHistoryContent.tsx
- src/pages/vagt-flow/LocationProfitabilityContent.tsx

### `login_events` (5)
- src/hooks/useLoginLog.ts
- supabase/functions/gdpr-data-cleanup/index.ts
- supabase/functions/gdpr-export-data/index.ts
- supabase/functions/gdpr-process-deletion/index.ts
- supabase/functions/log-login-event/index.ts

### `master_employee` (1)
- src/pages/MgTest.tsx

### `messages` (3)
- supabase/functions/process-scheduled-emails/index.ts
- supabase/functions/send-recruitment-email/index.ts
- supabase/functions/twilio-webhook/index.ts

### `onboarding_coaching_tasks` (2)
- src/hooks/useOnboarding.ts
- supabase/functions/gdpr-export-data/index.ts

### `onboarding_cohorts` (6)
- src/components/personnel/AddMemberDialog.tsx
- src/components/personnel/CreateCohortDialog.tsx
- src/components/personnel/EditCohortDialog.tsx
- src/components/recruitment/AssignCohortDialog.tsx
- src/pages/dashboards/CphSalesDashboard.tsx
- src/pages/personnel/UpcomingStarts.tsx

### `onboarding_days` (3)
- src/components/onboarding/EditDayDialog.tsx
- src/hooks/useOnboarding.ts
- src/pages/onboarding/OnboardingAdmin.tsx

### `onboarding_drills` (3)
- src/components/onboarding/DrillEditDialog.tsx
- src/hooks/useOnboarding.ts
- src/pages/onboarding/OnboardingAdmin.tsx

### `onboarding_week_expectations` (1)
- src/hooks/useWeekExpectations.ts

### `password_reset_tokens` (4)
- supabase/functions/gdpr-data-cleanup/index.ts
- supabase/functions/gdpr-process-deletion/index.ts
- supabase/functions/initiate-password-reset/index.ts
- supabase/functions/send-password-reset/index.ts

### `payroll_error_reports` (1)
- src/components/my-profile/PayrollErrorReportDialog.tsx

### `personnel_salaries` (12)
- src/components/salary/AddPersonnelDialog.tsx
- src/components/salary/AssistantSalary.tsx
- src/components/salary/ClientDBTab.tsx
- src/components/salary/CombinedSalaryTab.tsx
- src/components/salary/DBOverviewTab.tsx
- src/components/salary/EditPersonnelDialog.tsx
- src/components/salary/PersonnelOverviewCards.tsx
- src/components/salary/SalaryDashboardKPIs.tsx
- src/components/salary/StaffSalary.tsx
- src/components/salary/TeamLeaderSalary.tsx
- src/hooks/useAssistantHoursCalculation.ts
- src/hooks/useStaffHoursCalculation.ts

### `powerdag_events` (2)
- src/components/powerdag/PowerdagSettings.tsx
- src/hooks/usePowerdagData.ts

### `powerdag_point_rules` (3)
- src/components/powerdag/PowerdagSettings.tsx
- src/hooks/usePowerdagData.ts
- src/pages/dashboards/PowerdagInput.tsx

### `powerdag_scores` (1)
- src/hooks/usePowerdagData.ts

### `pricing_rule_history` (1)
- src/components/mg-test/PricingRuleEditor.tsx

### `product_campaign_overrides` (3)
- src/components/mg-test/ProductCampaignOverrides.tsx
- src/components/mg-test/ProductMergeDialog.tsx
- src/pages/MgTest.tsx

### `product_change_log` (3)
- src/components/cancellations/ApprovalQueueTab.tsx
- src/components/cancellations/ApprovedTab.tsx
- src/hooks/useSellerSalariesCached.ts

### `product_merge_history` (1)
- src/components/mg-test/ProductMergeDialog.tsx

### `product_price_history` (3)
- src/components/mg-test/ProductMergeDialog.tsx
- src/components/mg-test/ProductPriceEditDialog.tsx
- src/components/mg-test/ProductPricingRulesDialog.tsx

### `product_pricing_rules` (15)
- src/components/dashboard/DailyRevenueChart.tsx
- src/components/mg-test/CommissionRatesTab.tsx
- src/components/mg-test/PricingRuleEditor.tsx
- src/components/mg-test/ProductMergeDialog.tsx
- src/components/mg-test/ProductPricingRulesDialog.tsx
- src/hooks/useDashboardSalesData.ts
- src/hooks/useHasImmediatePaymentSales.ts
- src/hooks/useKpiTest.ts
- src/lib/calculations/fmPricing.ts
- src/pages/ImmediatePaymentASE.tsx
- src/pages/MgTest.tsx
- src/pages/reports/DailyReports.tsx
- src/pages/reports/RevenueByClient.tsx
- src/pages/vagt-flow/FieldmarketingDashboard.tsx
- supabase/functions/rematch-pricing-rules/index.ts

### `products` (26)
- src/components/cancellations/AddProductSection.tsx
- src/components/cancellations/ApprovalQueueTab.tsx
- src/components/cancellations/SellerMappingTab.tsx
- src/components/cancellations/UploadCancellationsTab.tsx
- src/components/mg-test/CampaignSuggestionDialog.tsx
- src/components/mg-test/CommissionRatesTab.tsx
- src/components/mg-test/ProductMergeDialog.tsx
- src/components/mg-test/ProductPriceEditDialog.tsx
- src/components/mg-test/ProductPricingRulesDialog.tsx
- src/hooks/useKpiTest.ts
- src/hooks/useSellerSalariesCached.ts
- src/lib/calculations/fmPricing.ts
- src/pages/MgTest.tsx
- src/pages/reports/DailyReports.tsx
- src/pages/vagt-flow/EditSalesRegistrations.tsx
- src/pages/vagt-flow/FieldmarketingDashboard.tsx
- src/pages/vagt-flow/SalesRegistration.tsx
- supabase/functions/adversus-webhook/index.ts
- supabase/functions/calculate-kpi-incremental/index.ts
- supabase/functions/calculate-kpi-values/index.ts
- supabase/functions/calculate-leaderboard-incremental/index.ts
- supabase/functions/dialer-webhook/index.ts
- supabase/functions/import-products/index.ts
- supabase/functions/rematch-pricing-rules/index.ts
- supabase/functions/snapshot-payroll-period/index.ts
- supabase/functions/sync-adversus/index.ts

### `pulse_survey_completions` (2)
- src/components/kpi/PublicLinksOverview.tsx
- supabase/functions/submit-employee-pulse-survey/index.ts

### `pulse_survey_dismissals` (1)
- src/hooks/usePulseSurvey.ts

### `pulse_survey_drafts` (2)
- src/hooks/usePulseSurvey.ts
- supabase/functions/submit-employee-pulse-survey/index.ts

### `pulse_survey_responses` (3)
- src/hooks/usePulseSurvey.ts
- supabase/functions/submit-employee-pulse-survey/index.ts
- supabase/functions/submit-pulse-survey/index.ts

### `pulse_surveys` (4)
- src/components/kpi/PublicLinksOverview.tsx
- src/hooks/usePulseSurvey.ts
- src/pages/PublicPulseSurvey.tsx
- supabase/functions/activate-pulse-survey/index.ts

### `quiz_templates` (1)
- src/hooks/useQuizTemplates.ts

### `role_page_permissions` (4)
- src/components/employees/permissions/PermissionEditor.tsx
- src/components/employees/permissions/PermissionEditorV2.tsx
- src/components/employees/permissions/PermissionMap.tsx
- src/hooks/usePositionPermissions.ts

### `salary_additions` (3)
- src/components/salary/AddSalaryAdditionDialog.tsx
- src/components/salary/SalaryAdditionCell.tsx
- src/hooks/useSellerSalariesCached.ts

### `salary_schemes` (1)
- src/pages/SalarySchemes.tsx

### `salary_type_employees` (1)
- src/components/salary/SalaryTypesTab.tsx

### `salary_types` (5)
- src/components/salary/ClientDBTab.tsx
- src/components/salary/SalaryTypesTab.tsx
- src/components/vagt-flow/EditBookingDialog.tsx
- src/hooks/useSellerSalariesCached.ts
- src/pages/vagt-flow/BookingsContent.tsx

### `sale_items` (29)
- src/components/cancellations/AddProductSection.tsx
- src/components/cancellations/ApprovalQueueTab.tsx
- src/components/cancellations/ApprovedTab.tsx
- src/components/cancellations/CancellationDialog.tsx
- src/components/cancellations/EditCartDialog.tsx
- src/components/cancellations/MatchErrorsSubTab.tsx
- src/components/cancellations/UnmatchedTab.tsx
- src/components/cancellations/UploadCancellationsTab.tsx
- src/components/dashboard/DailyRevenueChart.tsx
- src/components/dashboard/RelatelProductsBoard.tsx
- src/components/mg-test/CampaignSuggestionDialog.tsx
- src/components/mg-test/CommissionRatesTab.tsx
- src/components/mg-test/ProductMergeDialog.tsx
- src/components/system-stability/DataHealthChecks.tsx
- src/hooks/useHasImmediatePaymentSales.ts
- src/pages/ImmediatePaymentASE.tsx
- src/pages/MgTest.tsx
- src/pages/dashboards/CphSalesDashboard.tsx
- src/pages/economic/SalesValidation.tsx
- src/pages/reports/RevenueByClient.tsx
- src/pages/vagt-flow/EditSalesRegistrations.tsx
- supabase/functions/adversus-sync-v2/index.ts
- supabase/functions/adversus-webhook/index.ts
- supabase/functions/calculate-kpi-values/index.ts
- supabase/functions/dialer-webhook/index.ts
- supabase/functions/gdpr-data-cleanup/index.ts
- supabase/functions/rematch-pricing-rules/index.ts
- supabase/functions/sync-adversus/index.ts
- supabase/functions/tv-dashboard-data/index.ts

### `sales` (53)
- src/components/api-overview/EventDataTable.tsx
- src/components/cancellations/AddProductSection.tsx
- src/components/cancellations/ApprovalQueueTab.tsx
- src/components/cancellations/CancellationDialog.tsx
- src/components/cancellations/DuplicatesTab.tsx
- src/components/cancellations/EditCartDialog.tsx
- src/components/cancellations/LocateSaleDialog.tsx
- src/components/cancellations/ManualCancellationsTab.tsx
- src/components/cancellations/MatchErrorsSubTab.tsx
- src/components/cancellations/UnmatchedTab.tsx
- src/components/cancellations/UploadCancellationsTab.tsx
- src/components/dashboard/DailyRevenueChart.tsx
- src/components/home/HeadToHeadComparison.tsx
- src/components/mg-test/CampaignSuggestionDialog.tsx
- src/components/my-profile/PayrollDayByDay.tsx
- src/components/relatel/RelatelEventsTable.tsx
- src/components/sales/SalesFeed.tsx
- src/components/settings/DialerIntegrations.tsx
- src/components/settings/SyncSingleSaleDialog.tsx
- src/components/shift-planning/MissingShiftsAlert.tsx
- src/components/system-stability/DataHealthChecks.tsx
- src/hooks/useClientForecast.ts
- src/hooks/useDashboardKpiData.ts
- src/hooks/useFieldmarketingSales.ts
- src/hooks/useHasImmediatePaymentSales.ts
- src/hooks/useKpiTest.ts
- src/hooks/useTeamGoalForecast.ts
- src/pages/ImmediatePaymentASE.tsx
- src/pages/MgTest.tsx
- src/pages/MyProfile.tsx
- src/pages/OnboardingAnalyse.tsx
- src/pages/dashboards/CphSalesDashboard.tsx
- src/pages/economic/SalesValidation.tsx
- src/pages/shift-planning/ShiftOverview.tsx
- src/pages/vagt-flow/EditSalesRegistrations.tsx
- src/pages/vagt-flow/LocationHistoryContent.tsx
- src/pages/vagt-flow/LocationProfitabilityContent.tsx
- src/utils/fetchPerformance.ts
- supabase/functions/adversus-sync-v2/index.ts
- supabase/functions/adversus-webhook/index.ts
- supabase/functions/calculate-kpi-incremental/index.ts
- supabase/functions/calculate-kpi-values/index.ts
- supabase/functions/calculate-leaderboard-incremental/index.ts
- supabase/functions/dialer-webhook/index.ts
- supabase/functions/enreach-diagnostics/index.ts
- supabase/functions/enrichment-healer/index.ts
- supabase/functions/gdpr-data-cleanup/index.ts
- supabase/functions/gdpr-export-data/index.ts
- supabase/functions/parse-expense-formula/index.ts
- supabase/functions/probe-enreach-integration/index.ts
- supabase/functions/snapshot-payroll-period/index.ts
- supabase/functions/sync-adversus/index.ts
- supabase/functions/tdc-opp-backfill/index.ts

### `sales_validation_uploads` (1)
- src/pages/economic/SalesValidation.tsx

### `scheduled_emails` (3)
- src/components/recruitment/ScheduledEmailsList.tsx
- src/components/recruitment/SendEmailDialog.tsx
- supabase/functions/process-scheduled-emails/index.ts

### `scheduled_team_changes` (2)
- src/components/employees/TeamsTab.tsx
- supabase/functions/execute-scheduled-team-changes/index.ts

### `security_incidents` (1)
- src/hooks/useSecurityIncidents.ts

### `sensitive_data_access_log` (2)
- src/hooks/useLogSensitiveAccess.ts
- src/pages/compliance/SensitiveAccessLog.tsx

### `shift` (14)
- src/components/kpi/FormulaLiveTest.tsx
- src/components/my-profile/PayrollDayByDay.tsx
- src/components/vagt-flow/AddEmployeeDialog.tsx
- src/components/vagt-flow/EditBookingDialog.tsx
- src/hooks/useAssistantHoursCalculation.ts
- src/hooks/useDashboardKpiData.ts
- src/hooks/useEffectiveHourlyRate.ts
- src/hooks/useKpiTest.ts
- src/hooks/useShiftPlanning.ts
- src/hooks/useShiftResolution.ts
- src/hooks/useStaffHoursCalculation.ts
- src/hooks/useTeamGoalForecast.ts
- src/pages/ExtraWork.tsx
- src/pages/UnitedDashboard.tsx

### `short_link_clicks` (3)
- src/pages/ShortLinkRedirect.tsx
- src/pages/recruitment/BookingFlowEngagement.tsx
- supabase/functions/r/index.ts

### `short_links` (5)
- src/pages/ShortLinkRedirect.tsx
- src/pages/recruitment/BookingFlowEngagement.tsx
- supabase/functions/auto-segment-candidate/index.ts
- supabase/functions/process-booking-flow/index.ts
- supabase/functions/r/index.ts

### `sidebar_menu_config` (1)
- src/hooks/useSidebarMenuConfig.ts

### `sms_templates` (2)
- src/components/recruitment/SendSmsDialog.tsx
- src/pages/recruitment/SmsTemplates.tsx

### `supplier_contacts` (2)
- src/components/billing/SendToSupplierDialog.tsx
- src/components/billing/SupplierContactsTab.tsx

### `supplier_discount_rules` (4)
- src/components/billing/DiscountRulesTab.tsx
- src/components/billing/ExpenseReportTab.tsx
- src/components/billing/SupplierReportTab.tsx
- src/pages/vagt-flow/Billing.tsx

### `supplier_invoice_reports` (2)
- src/components/billing/SupplierReportTab.tsx
- supabase/functions/send-supplier-report/index.ts

### `supplier_location_exceptions` (4)
- src/components/billing/DiscountRulesTab.tsx
- src/components/billing/ExpenseReportTab.tsx
- src/components/billing/SupplierReportTab.tsx
- src/pages/vagt-flow/Billing.tsx

### `sync_failed_records` (1)
- supabase/functions/sync-health-check/index.ts

### `system_feedback` (1)
- src/pages/SystemFeedback.tsx

### `system_feedback_access` (2)
- src/components/layout/AppSidebar.tsx
- src/pages/SystemFeedback.tsx

### `system_feedback_comments` (1)
- src/pages/SystemFeedback.tsx

### `system_feedback_recipients` (1)
- src/pages/SystemFeedback.tsx

### `system_role_definitions` (4)
- src/components/employees/PositionsTab.tsx
- src/components/employees/permissions/PermissionEditor.tsx
- src/components/employees/permissions/PermissionEditorV2.tsx
- src/hooks/useUnifiedPermissions.ts

### `system_roles` (9)
- src/hooks/useSystemRoles.ts
- src/hooks/useUnifiedPermissions.ts
- supabase/functions/batch-set-fieldmarketing-passwords/index.ts
- supabase/functions/complete-employee-registration/index.ts
- supabase/functions/complete-password-reset/index.ts
- supabase/functions/create-employee-user/index.ts
- supabase/functions/delete-auth-user/index.ts
- supabase/functions/send-career-wish-notification/index.ts
- supabase/functions/set-user-password/index.ts

### `tdc_cancellation_imports` (1)
- src/pages/Settings.tsx

### `team_assistant_leaders` (7)
- src/components/employees/TeamsTab.tsx
- src/components/salary/ClientDBTab.tsx
- src/hooks/useShiftPlanning.ts
- src/hooks/useTeamAssistantLeaders.ts
- src/pages/reports/DailyReports.tsx
- src/pages/shift-planning/AbsenceManagement.tsx
- supabase/functions/notify-vehicle-returned/index.ts

### `team_client_daily_bonus` (2)
- src/components/employees/TeamsTab.tsx
- src/pages/shift-planning/ShiftOverview.tsx

### `team_clients` (25)
- src/components/employees/TeamsTab.tsx
- src/components/personnel/AddMemberDialog.tsx
- src/components/personnel/CreateCohortDialog.tsx
- src/components/personnel/EditMemberClientDialog.tsx
- src/components/recruitment/AssignCohortDialog.tsx
- src/components/salary/EditPersonnelDialog.tsx
- src/components/salary/TeamLeaderSalary.tsx
- src/components/vagt-flow/CapacityPanel.tsx
- src/components/vagt-flow/EditBookingDialog.tsx
- src/hooks/useDashboardKpiData.ts
- src/hooks/useTeamGoalForecast.ts
- src/pages/MgTest.tsx
- src/pages/UnitedDashboard.tsx
- src/pages/dashboards/CphSalesDashboard.tsx
- src/pages/reports/DailyReports.tsx
- src/pages/vagt-flow/Billing.tsx
- src/pages/vagt-flow/BookWeekContent.tsx
- src/pages/vagt-flow/Bookings.tsx
- src/pages/vagt-flow/BookingsContent.tsx
- src/pages/vagt-flow/LocationDetail.tsx
- src/pages/vagt-flow/Locations.tsx
- src/pages/vagt-flow/LocationsContent.tsx
- src/pages/vagt-flow/MarketsContent.tsx
- supabase/functions/calculate-kpi-values/index.ts
- supabase/functions/tv-dashboard-data/index.ts

### `team_dashboard_permissions` (1)
- src/hooks/useTeamDashboardPermissions.ts

### `team_expenses` (8)
- src/components/salary/AddTeamExpenseDialog.tsx
- src/components/salary/ClientDBTab.tsx
- src/components/salary/CreateAIExpenseDialog.tsx
- src/components/salary/DBDailyBreakdown.tsx
- src/components/salary/DBOverviewTab.tsx
- src/components/salary/EditTeamExpenseDialog.tsx
- src/components/salary/TeamExpensesTab.tsx
- supabase/functions/recalculate-dynamic-expenses/index.ts

### `team_members` (53)
- src/components/absence/PendingAbsencePopup.tsx
- src/components/company-overview/ChurnCalculator.tsx
- src/components/company-overview/ChurnTrendChart.tsx
- src/components/company-overview/ChurnTrendChart30Days.tsx
- src/components/company-overview/ChurnTrendChart60DaysFiltered.tsx
- src/components/company-overview/ChurnTrendChartCombined.tsx
- src/components/company-overview/HistoricalTenureStats.tsx
- src/components/company-overview/NewHireChurnKpi.tsx
- src/components/company-overview/TeamAvgTenureChart.tsx
- src/components/employee/EmployeeCommissionHistory.tsx
- src/components/employees/StaffEmployeesTab.tsx
- src/components/employees/TeamStandardShifts.tsx
- src/components/employees/TeamsTab.tsx
- src/components/home/HeadToHeadComparison.tsx
- src/components/kpi/FormulaLiveTest.tsx
- src/components/layout/AppSidebar.tsx
- src/components/profile/MyScheduleTabContent.tsx
- src/components/salary/ClientDBTab.tsx
- src/components/salary/DBOverviewTab.tsx
- src/components/shift-planning/CreateShiftDialog.tsx
- src/components/vagt-flow/CapacityPanel.tsx
- src/hooks/useAssistantHoursCalculation.ts
- src/hooks/useChat.ts
- src/hooks/useClientForecast.ts
- src/hooks/useCpoRevenue.ts
- src/hooks/useDashboardSalesData.ts
- src/hooks/useKpiTest.ts
- src/hooks/useLeagueActiveData.ts
- src/hooks/useLeagueData.ts
- src/hooks/useShiftPlanning.ts
- src/hooks/useShiftResolution.ts
- src/hooks/useStaffHoursCalculation.ts
- src/hooks/useTeamDashboardPermissions.ts
- src/hooks/useTeamGoalForecast.ts
- src/hooks/useVagtEmployee.ts
- src/pages/CompanyOverview.tsx
- src/pages/EmployeeMasterData.tsx
- src/pages/MyProfile.tsx
- src/pages/OnboardingAnalyse.tsx
- src/pages/dashboards/CphSalesDashboard.tsx
- src/pages/onboarding/LeaderOnboardingView.tsx
- src/pages/reports/DailyReports.tsx
- src/pages/shift-planning/AbsenceManagement.tsx
- src/pages/shift-planning/MySchedule.tsx
- src/pages/shift-planning/ShiftOverview.tsx
- src/pages/shift-planning/TimeTracking.tsx
- src/pages/vagt-flow/BookingsContent.tsx
- src/pages/vagt-flow/MarketsContent.tsx
- src/pages/vagt-flow/VagtplanFMContent.tsx
- supabase/functions/calculate-kpi-values/index.ts
- supabase/functions/calculate-leaderboard-incremental/index.ts
- supabase/functions/execute-scheduled-team-changes/index.ts
- supabase/functions/tv-dashboard-data/index.ts

### `team_memberships` (1)
- src/components/shift-planning/MissingShiftsAlert.tsx

### `team_monthly_goals` (1)
- src/pages/TeamGoals.tsx

### `team_sales_goals` (1)
- supabase/functions/calculate-kpi-values/index.ts

### `team_shift_breaks` (1)
- src/components/employees/TeamStandardShifts.tsx

### `team_standard_shift_days` (21)
- src/components/employee/EmployeeCommissionHistory.tsx
- src/components/employees/TeamStandardShifts.tsx
- src/components/kpi/FormulaLiveTest.tsx
- src/components/profile/MyScheduleTabContent.tsx
- src/components/shift-planning/CreateShiftDialog.tsx
- src/components/shift-planning/MissingShiftsAlert.tsx
- src/components/vagt-flow/AddEmployeeDialog.tsx
- src/components/vagt-flow/CapacityPanel.tsx
- src/components/vagt-flow/EditBookingDialog.tsx
- src/hooks/useAssistantHoursCalculation.ts
- src/hooks/useDashboardSalesData.ts
- src/hooks/useKpiTest.ts
- src/hooks/useShiftResolution.ts
- src/hooks/useStaffHoursCalculation.ts
- src/hooks/useTeamGoalForecast.ts
- src/pages/reports/DailyReports.tsx
- src/pages/shift-planning/MySchedule.tsx
- src/pages/shift-planning/ShiftOverview.tsx
- src/pages/vagt-flow/VagtplanFMContent.tsx
- supabase/functions/calculate-kpi-values/index.ts
- supabase/functions/tv-dashboard-data/index.ts

### `team_standard_shifts` (20)
- src/components/employee/EmployeeCommissionHistory.tsx
- src/components/employees/TeamStandardShifts.tsx
- src/components/kpi/FormulaLiveTest.tsx
- src/components/profile/MyScheduleTabContent.tsx
- src/components/shift-planning/CreateShiftDialog.tsx
- src/components/shift-planning/MissingShiftsAlert.tsx
- src/components/vagt-flow/AddEmployeeDialog.tsx
- src/components/vagt-flow/EditBookingDialog.tsx
- src/hooks/useAssistantHoursCalculation.ts
- src/hooks/useDashboardSalesData.ts
- src/hooks/useKpiTest.ts
- src/hooks/useShiftResolution.ts
- src/hooks/useStaffHoursCalculation.ts
- src/hooks/useTeamGoalForecast.ts
- src/pages/reports/DailyReports.tsx
- src/pages/shift-planning/MySchedule.tsx
- src/pages/shift-planning/ShiftOverview.tsx
- src/pages/vagt-flow/VagtplanFMContent.tsx
- supabase/functions/calculate-kpi-values/index.ts
- supabase/functions/tv-dashboard-data/index.ts

### `teams` (49)
- src/components/absence/PendingAbsencePopup.tsx
- src/components/employees/TeamLeaderTeams.tsx
- src/components/employees/TeamsTab.tsx
- src/components/forecast/CreateForecastDialog.tsx
- src/components/home/EditEventDialog.tsx
- src/components/layout/AppSidebar.tsx
- src/components/personnel/CreateCohortDialog.tsx
- src/components/recruitment/AssignCohortDialog.tsx
- src/components/salary/ClientDBTab.tsx
- src/components/salary/DBOverviewTab.tsx
- src/components/salary/EditPersonnelDialog.tsx
- src/components/salary/SellerSalariesTab.tsx
- src/components/salary/TeamExpensesTab.tsx
- src/components/salary/TeamLeaderSalary.tsx
- src/components/vagt-flow/AddEmployeeDialog.tsx
- src/components/vagt-flow/CapacityPanel.tsx
- src/components/vagt-flow/EditBookingDialog.tsx
- src/hooks/useChat.ts
- src/hooks/useEconomicData.ts
- src/hooks/useRecognitionKpis.ts
- src/hooks/useShiftPlanning.ts
- src/hooks/useTeamDashboardPermissions.ts
- src/hooks/useVagtEmployee.ts
- src/pages/ClosingShifts.tsx
- src/pages/Home.tsx
- src/pages/PublicPulseSurvey.tsx
- src/pages/PulseSurvey.tsx
- src/pages/PulseSurveyResults.tsx
- src/pages/TeamGoals.tsx
- src/pages/Teams.tsx
- src/pages/UnitedDashboard.tsx
- src/pages/reports/DailyReports.tsx
- src/pages/reports/ReportsAdmin.tsx
- src/pages/shift-planning/AbsenceManagement.tsx
- src/pages/vagt-flow/Billing.tsx
- src/pages/vagt-flow/BookWeekContent.tsx
- src/pages/vagt-flow/Bookings.tsx
- src/pages/vagt-flow/BookingsContent.tsx
- src/pages/vagt-flow/LocationDetail.tsx
- src/pages/vagt-flow/Locations.tsx
- src/pages/vagt-flow/LocationsContent.tsx
- src/pages/vagt-flow/MarketsContent.tsx
- src/pages/vagt-flow/VagtplanFMContent.tsx
- supabase/functions/calculate-kpi-values/index.ts
- supabase/functions/notify-vehicle-returned/index.ts
- supabase/functions/parse-expense-formula/index.ts
- supabase/functions/submit-employee-pulse-survey/index.ts
- supabase/functions/tv-dashboard-data/index.ts
- supabase/functions/tv-league-data/index.ts

### `time_entry` (2)
- src/hooks/useShiftPlanning.ts
- src/pages/shift-planning/TimeTracking.tsx

### `time_stamps` (15)
- src/components/employee/EmployeeCommissionHistory.tsx
- src/components/shift-planning/EditTimeStampDialog.tsx
- src/hooks/useCpoRevenue.ts
- src/hooks/useDashboardSalesData.ts
- src/hooks/useEffectiveHourlyRate.ts
- src/hooks/useKpiTest.ts
- src/hooks/useStaffHoursCalculation.ts
- src/hooks/useTimeStamps.ts
- src/pages/EmployeeDetail.tsx
- src/pages/MyProfile.tsx
- src/pages/reports/DailyReports.tsx
- src/pages/shift-planning/ShiftOverview.tsx
- src/pages/vagt-flow/VagtplanFMContent.tsx
- supabase/functions/calculate-kpi-values/index.ts
- supabase/functions/tv-dashboard-data/index.ts

### `transactions` (1)
- supabase/functions/economic-webhook/index.ts

### `trusted_ip_ranges` (2)
- src/pages/admin/SecurityDashboard.tsx
- supabase/functions/check-mfa-exempt/index.ts

### `tv_board_access` (9)
- src/components/dashboard/TvBoardQuickGenerator.tsx
- src/components/dashboard/TvLinkEditDialog.tsx
- src/components/dashboard/TvLinksSettingsTab.tsx
- src/components/kpi/PublicLinksOverview.tsx
- src/hooks/tv-board/useTvBoardConfig.ts
- src/pages/tv-board/TvBoardAdmin.tsx
- src/pages/tv-board/TvBoardLogin.tsx
- src/pages/tv-board/TvBoardView.tsx
- supabase/functions/tv-dashboard-data/index.ts

### `vehicle` (4)
- src/pages/vagt-flow/Bookings.tsx
- src/pages/vagt-flow/BookingsContent.tsx
- src/pages/vagt-flow/MarketsContent.tsx
- src/pages/vagt-flow/Vehicles.tsx

### `vehicle_mileage` (2)
- src/pages/vagt-flow/Bookings.tsx
- src/pages/vagt-flow/Vehicles.tsx

### `vehicle_return_confirmation` (2)
- src/pages/vagt-flow/MyBookingSchedule.tsx
- supabase/functions/notify-vehicle-returned/index.ts

### `webhook_endpoints` (1)
- src/pages/Settings.tsx

### `weekend_cleanup_config` (2)
- src/pages/ClosingShifts.tsx
- supabase/functions/send-weekend-cleanup/index.ts

## 2. RPC → Kaldere

Total: **41** RPC'er kaldt fra kode.

### `auto_suggest_konto_mapping` (1)
- src/hooks/useEconomicData.ts

### `complete_invitation_password` (1)
- supabase/functions/complete-employee-registration/index.ts

### `consume_password_reset_token` (1)
- supabase/functions/complete-password-reset/index.ts

### `get_active_cron_jobs` (2)
- src/components/system-stability/LiveCronStatus.tsx
- src/pages/SystemStability.tsx

### `get_aggregated_product_types` (2)
- src/components/mg-test/ProductMergeDialog.tsx
- src/pages/MgTest.tsx

### `get_auth_email_by_work_email` (1)
- src/pages/Auth.tsx

### `get_call_stats` (1)
- src/hooks/useDashboardKpiData.ts

### `get_client_sales_stats` (1)
- src/pages/boards/SalesDashboard.tsx

### `get_coaching_coverage_stats` (1)
- src/hooks/useOnboarding.ts

### `get_cs_top20_custom_period_leaderboard` (1)
- src/pages/CsTop20Dashboard.tsx

### `get_current_employee_id` (6)
- src/hooks/useChat.ts
- src/hooks/useGdpr.ts
- src/hooks/usePendingContractLock.ts
- src/hooks/useShiftPlanning.ts
- src/pages/CommissionLeague.tsx
- src/pages/MyGoals.tsx

### `get_dialer_credentials` (14)
- supabase/functions/adversus-create-webhook/index.ts
- supabase/functions/adversus-diagnostics/index.ts
- supabase/functions/adversus-lead-check/index.ts
- supabase/functions/adversus-manage-webhooks/index.ts
- supabase/functions/alka-attribution-probe/index.ts
- supabase/functions/alka-reference-lookup/index.ts
- supabase/functions/client-sales-overview/index.ts
- supabase/functions/enreach-diagnostics/index.ts
- supabase/functions/enreach-manage-webhooks/index.ts
- supabase/functions/enrichment-healer/index.ts
- supabase/functions/integration-engine/index.ts
- supabase/functions/probe-enreach-integration/index.ts
- supabase/functions/tdc-opp-backfill/index.ts
- supabase/functions/test-ase-leads/index.ts

### `get_distinct_agent_emails_for_client` (1)
- src/pages/reports/DailyReports.tsx

### `get_distinct_cached_kpi_slugs` (1)
- src/hooks/useCachedKpiSlugs.ts

### `get_distinct_sales_sources` (1)
- src/components/sales/SalesFeed.tsx

### `get_employee_roles_for_admin` (1)
- src/pages/Permissions.tsx

### `get_invitation_by_token_v2` (2)
- src/pages/EmployeeOnboarding.tsx
- supabase/functions/complete-employee-registration/index.ts

### `get_personal_daily_commission` (2)
- src/hooks/usePersonalWeeklyStats.ts
- src/hooks/useSalesGamification.ts

### `get_pulse_survey_dismissal` (2)
- src/hooks/usePulseSurvey.ts
- src/hooks/usePulseSurveyLock.ts

### `get_pulse_survey_draft` (1)
- src/hooks/usePulseSurvey.ts

### `get_referrer_by_code` (2)
- src/hooks/useReferrals.ts
- supabase/functions/submit-referral/index.ts

### `get_sales_aggregates` (1)
- src/hooks/useSalesAggregates.ts

### `get_sales_aggregates_v2` (11)
- src/components/home/HeadToHeadComparison.tsx
- src/hooks/useClientForecast.ts
- src/hooks/useLeagueRoundProvision.ts
- src/hooks/useLeagueTodayProvision.ts
- src/hooks/useLeagueWeeklyProvision.ts
- src/hooks/useRecognitionKpis.ts
- src/hooks/useSalesAggregatesExtended.ts
- src/pages/economic/EconomicRevenueMatch.tsx
- supabase/functions/league-calculate-standings/index.ts
- supabase/functions/league-process-round/index.ts
- supabase/functions/tv-league-data/index.ts

### `get_sales_report_detailed` (2)
- src/hooks/useClientForecast.ts
- src/pages/reports/ReportsManagement.tsx

### `get_sales_report_raw` (1)
- src/pages/reports/ReportsManagement.tsx

### `get_sales_without_items_count` (1)
- src/components/system-stability/DataHealthChecks.tsx

### `get_source_counts` (1)
- src/components/api-overview/ApiDataOverview.tsx

### `get_team_performance_summary` (1)
- src/pages/dashboards/CphSalesDashboard.tsx

### `get_unread_message_count` (1)
- src/components/layout/AppSidebar.tsx

### `has_completed_pulse_survey` (1)
- src/hooks/usePulseSurvey.ts

### `has_position_permission` (1)
- supabase/functions/send-code-of-conduct-reminder/index.ts

### `has_valid_code_of_conduct_completion` (2)
- src/hooks/useCodeOfConduct.ts
- src/hooks/useCodeOfConductReminder.ts

### `is_manager_or_above` (3)
- supabase/functions/create-employee-user/index.ts
- supabase/functions/reset-login-attempts/index.ts
- supabase/functions/reset-user-mfa/index.ts

### `is_owner` (8)
- src/components/layout/AppSidebar.tsx
- src/hooks/useShiftPlanning.ts
- src/pages/SystemFeedback.tsx
- supabase/functions/delete-auth-user/index.ts
- supabase/functions/force-password-reset/index.ts
- supabase/functions/send-ai-instruction-email/index.ts
- supabase/functions/send-code-of-conduct-reminder/index.ts
- supabase/functions/unlock-account/index.ts

### `is_teamleder_or_above` (1)
- supabase/functions/set-user-password/index.ts

### `rollback_cancellation_import` (2)
- src/components/cancellations/ApprovalQueueTab.tsx
- src/components/cancellations/UploadCancellationsTab.tsx

### `schedule_integration_sync` (1)
- supabase/functions/update-cron-schedule/index.ts

### `search_sales` (2)
- src/components/sales/SalesFeed.tsx
- src/components/settings/SyncSingleSaleDialog.tsx

### `unschedule_integration_sync` (1)
- supabase/functions/update-cron-schedule/index.ts

### `update_checklist_email_cron` (1)
- src/hooks/useFmChecklist.ts

### `validate_password_reset_token` (2)
- supabase/functions/complete-password-reset/index.ts
- supabase/functions/validate-reset-token/index.ts

## 3. Edge Function → Invokers

Total: **56** edge functions invoket fra kode.

### `adversus-create-webhook` (1)
- src/components/settings/DialerIntegrations.tsx

### `adversus-manage-webhooks` (1)
- src/components/settings/DialerIntegrations.tsx

### `auto-segment-candidate` (1)
- src/components/recruitment/SegmentationModal.tsx

### `calculate-kpi-incremental` (1)
- src/hooks/useMgTestMutationSync.ts

### `check-account-locked` (1)
- src/pages/Auth.tsx

### `check-compliance-reviews` (1)
- src/pages/compliance/ComplianceNotifications.tsx

### `check-mfa-exempt` (1)
- src/hooks/useMfa.ts

### `client-sales-overview` (1)
- src/pages/ClientSalesOverview.tsx

### `complete-employee-registration` (1)
- src/pages/EmployeeOnboarding.tsx

### `complete-password-reset` (1)
- src/pages/ResetPassword.tsx

### `create-employee-user` (2)
- src/components/employees/StaffEmployeesTab.tsx
- src/pages/EmployeeMasterData.tsx

### `end-call` (1)
- src/components/calls/CallModal.tsx

### `enreach-manage-webhooks` (1)
- src/components/settings/DialerIntegrations.tsx

### `enrichment-healer` (1)
- src/components/settings/SyncSingleSaleDialog.tsx

### `force-password-reset` (1)
- src/pages/admin/SecurityDashboard.tsx

### `generate-contract-pdf` (1)
- src/pages/ContractSign.tsx

### `generate-dashboard-layout` (1)
- src/components/dashboard/AIDashboardWizard.tsx

### `get-public-availability` (2)
- src/components/recruitment/BookingPreviewTab.tsx
- src/pages/recruitment/PublicCandidateBooking.tsx

### `import-economic-zip` (1)
- src/pages/admin/EconomicUpload.tsx

### `initiate-password-reset` (2)
- src/pages/Auth.tsx
- src/pages/EmployeeDetail.tsx

### `integration-engine` (6)
- src/components/mg-test/IntegrationMappingEditor.tsx
- src/components/settings/BatchMigrationDialog.tsx
- src/components/settings/DialerIntegrations.tsx
- src/components/settings/SyncDateRangeDialog.tsx
- src/pages/MgTest.tsx
- src/pages/Settings.tsx

### `league-calculate-standings` (1)
- src/pages/CommissionLeague.tsx

### `log-login-event` (1)
- src/hooks/useAuth.tsx

### `notify-feedback-status-change` (1)
- src/pages/SystemFeedback.tsx

### `notify-system-feedback` (1)
- src/pages/SystemFeedback.tsx

### `notify-vehicle-returned` (1)
- src/pages/vagt-flow/MyBookingSchedule.tsx

### `parse-expense-formula` (2)
- src/components/salary/CreateAIExpenseDialog.tsx
- src/components/salary/EditTeamExpenseDialog.tsx

### `public-book-candidate` (1)
- src/pages/recruitment/PublicCandidateBooking.tsx

### `recalculate-dynamic-expenses` (1)
- src/components/salary/TeamExpensesTab.tsx

### `regenerate-flow-touchpoints` (1)
- src/pages/recruitment/BookingFlow.tsx

### `rematch-pricing-rules` (6)
- src/components/cancellations/ApprovalQueueTab.tsx
- src/components/cancellations/ApprovedTab.tsx
- src/components/mg-test/ProductMergeDialog.tsx
- src/hooks/useRematchPricingRules.ts
- src/pages/MgTest.tsx
- src/pages/vagt-flow/EditSalesRegistrations.tsx

### `reset-login-attempts` (1)
- src/pages/EmployeeDetail.tsx

### `reset-user-mfa` (1)
- src/pages/admin/SecurityDashboard.tsx

### `scheduler-manager` (1)
- src/components/settings/DialerIntegrations.tsx

### `send-car-quiz-result` (1)
- src/hooks/useCarQuiz.ts

### `send-career-wish-notification` (2)
- src/components/profile/CareerWishesTabContent.tsx
- src/pages/CareerWishes.tsx

### `send-closing-reminder` (1)
- src/pages/ClosingShifts.tsx

### `send-contract-email` (1)
- src/components/contracts/SendContractDialog.tsx

### `send-deactivation-reminder` (2)
- src/components/employees/StaffEmployeesTab.tsx
- src/pages/EmployeeMasterData.tsx

### `send-employee-invitation` (4)
- src/components/employees/StaffEmployeesTab.tsx
- src/pages/EmployeeMasterData.tsx
- src/pages/personnel/UpcomingStarts.tsx
- src/pages/recruitment/CandidateDetail.tsx

### `send-employee-sms` (3)
- src/components/employees/SendEmployeeSmsDialog.tsx
- src/components/home/HeadToHeadComparison.tsx
- src/components/messages/EmployeeSmsTab.tsx

### `send-recruitment-email` (2)
- src/components/recruitment/SendEmailDialog.tsx
- src/pages/recruitment/BookingFlow.tsx

### `send-recruitment-sms` (2)
- src/components/recruitment/SendSmsDialog.tsx
- src/hooks/useCalendarBooking.ts

### `send-supplier-report` (1)
- src/components/billing/SendToSupplierDialog.tsx

### `send-test-email` (2)
- src/pages/EmailTemplates.tsx
- src/pages/recruitment/EmailTemplates.tsx

### `send-weekend-cleanup` (1)
- src/pages/ClosingShifts.tsx

### `set-user-password` (1)
- src/pages/EmployeeDetail.tsx

### `submit-employee-pulse-survey` (1)
- src/hooks/usePulseSurvey.ts

### `submit-pulse-survey` (1)
- src/pages/PublicPulseSurvey.tsx

### `submit-referral` (1)
- src/hooks/useReferrals.ts

### `sync-contracts-to-sharepoint` (1)
- src/pages/Contracts.tsx

### `tv-dashboard-data` (2)
- src/pages/dashboards/CphSalesDashboard.tsx
- src/pages/dashboards/SalesOverviewAll.tsx

### `twilio-access-token` (1)
- src/hooks/useTwilioDevice.ts

### `unsubscribe-candidate` (2)
- src/pages/recruitment/PublicCandidateBooking.tsx
- src/pages/recruitment/PublicUnsubscribe.tsx

### `update-cron-schedule` (3)
- src/components/system-stability/AuditLog.tsx
- src/components/system-stability/ScheduleEditor.tsx
- src/pages/Settings.tsx

### `validate-reset-token` (1)
- src/pages/ResetPassword.tsx

## 4. Realtime Channel → Subscribers

### `call-${callSid}` (1)
- src/components/calls/CallModal.tsx

### `candidate-chat-${candidateId}` (1)
- src/components/recruitment/CandidateChatHistory.tsx

### `employee-sms-realtime` (1)
- src/hooks/useEmployeeSmsConversations.ts

### `employee-sms-updates` (1)
- src/components/employees/SendEmployeeSmsDialog.tsx

### `messages-${conversationId}` (1)
- src/hooks/useChat.ts

### `messages-realtime` (1)
- src/pages/recruitment/Messages.tsx

### `mg-test-sync` (2)
- src/hooks/useMgTestMutationSync.ts
- src/hooks/useMgTestRealtimeSync.ts

### `online-users` (1)
- src/hooks/useChat.ts

### `qualification-${season.id}` (1)
- src/pages/CommissionLeague.tsx

### `qualification-standings-${seasonId}` (1)
- src/hooks/useLeagueData.ts

### `sales-feed-realtime` (1)
- src/components/sales/SalesFeed.tsx

### `sms-updates` (1)
- src/components/recruitment/SendSmsDialog.tsx

### `typing-${conversationId}` (1)
- src/hooks/useChat.ts

## 5. Hook → Forbrugere

Total: **107** custom hooks.

### `useAchievementTargets` (3)
- src/components/my-profile/SalesAchievements.tsx
- src/components/my-profile/SalesGoalTracker.tsx
- src/lib/gamification-achievements.ts

### `useAgentNameResolver` (5)
- src/components/cancellations/ApprovalQueueTab.tsx
- src/components/cancellations/ApprovedTab.tsx
- src/components/cancellations/DuplicatesTab.tsx
- src/components/cancellations/ManualCancellationsTab.tsx
- src/components/cancellations/UploadCancellationsTab.tsx

### `useAggregatedClientCache` (1)
- src/components/dashboard/ClientDashboard.tsx

### `useAssistantHoursCalculation` (2)
- src/components/salary/ClientDBTab.tsx
- src/components/salary/DBOverviewTab.tsx

### `useAuth` (52)
- src/components/RoleProtectedRoute.tsx
- src/components/absence/PendingAbsencePopup.tsx
- src/components/cancellations/ApprovalQueueTab.tsx
- src/components/cancellations/UploadCancellationsTab.tsx
- src/components/layout/AppSidebar.tsx
- src/components/league/LeagueAnnouncementPopup.tsx
- src/components/league/LeaguePromoCard.tsx
- src/components/personnel/CreateCohortDialog.tsx
- src/components/shift-planning/MarkSickDialog.tsx
- src/hooks/useCarQuiz.ts
- src/hooks/useCodeOfConduct.ts
- src/hooks/useCodeOfConductReminder.ts
- src/hooks/useEmployeeSmsConversations.ts
- src/hooks/useExtraWork.ts
- src/hooks/useFieldmarketingEmployee.ts
- src/hooks/useFmChecklist.ts
- src/hooks/useGdpr.ts
- src/hooks/useGoalLock.ts
- src/hooks/useHasImmediatePaymentSales.ts
- src/hooks/useLeagueActiveData.ts
- src/hooks/useLeagueData.ts
- src/hooks/useOnboarding.ts
- src/hooks/usePendingContractLock.ts
- src/hooks/usePositionPermissions.ts
- src/hooks/usePulseSurvey.ts
- src/hooks/usePulseSurveyLock.ts
- src/hooks/useRejectedContractLock.ts
- src/hooks/useShiftPlanning.ts
- src/hooks/useSystemRoles.ts
- src/hooks/useTeamDashboardPermissions.ts
- src/hooks/useTimeStamps.ts
- src/hooks/useUnifiedPermissions.ts
- src/hooks/useVagtEmployee.ts
- src/pages/Auth.tsx
- src/pages/CareerWishes.tsx
- src/pages/CareerWishesOverview.tsx
- src/pages/CodeOfConductAdmin.tsx
- src/pages/CommissionLeague.tsx
- src/pages/ContractSign.tsx
- src/pages/ExtraWork.tsx
- src/pages/ExtraWorkAdmin.tsx
- src/pages/HeadToHead.tsx
- src/pages/Home.tsx
- src/pages/ImmediatePaymentASE.tsx
- src/pages/PulseSurvey.tsx
- src/pages/SystemFeedback.tsx
- src/pages/dashboards/DashboardHome.tsx
- src/pages/reports/RevenueByClient.tsx
- src/pages/vagt-flow/FmChecklistContent.tsx
- src/pages/vagt-flow/MyBookingSchedule.tsx
- src/pages/vagt-flow/SalesRegistration.tsx
- src/routes/guards.tsx

### `useBookingHotels` (5)
- src/components/vagt-flow/AssignHotelDialog.tsx
- src/components/vagt-flow/EditBookingDialog.tsx
- src/components/vagt-flow/HotelRegistry.tsx
- src/pages/vagt-flow/BookingsContent.tsx
- src/pages/vagt-flow/HotelsContent.tsx

### `useCachedKpiSlugs` (2)
- src/components/kpi/KpiOverview.tsx
- src/pages/admin/KpiDefinitions.tsx

### `useCachedLeaderboard` (5)
- src/components/dashboard/ClientDashboard.tsx
- src/hooks/useAggregatedClientCache.ts
- src/pages/CsTop20Dashboard.tsx
- src/pages/dashboards/CphSalesDashboard.tsx
- src/pages/dashboards/PowerdagBoard.tsx

### `useCalendarBooking` (1)
- src/components/recruitment/CalendarBookingModal.tsx

### `useCandidateSources` (1)
- src/components/recruitment/CandidateSourceSelect.tsx

### `useCarQuiz` (4)
- src/components/layout/AppSidebar.tsx
- src/components/layout/LockOverlays.tsx
- src/pages/CarQuiz.tsx
- src/pages/CarQuizAdmin.tsx

### `useCelebrationData` (3)
- src/components/dashboard/TvLinkEditDialog.tsx
- src/components/dashboard/TvLinksSettingsTab.tsx
- src/pages/tv-board/TvBoardDirect.tsx

### `useChat` (6)
- src/components/messages/ChatView.tsx
- src/components/messages/ConversationList.tsx
- src/components/messages/MentionInput.tsx
- src/components/messages/MessageBubble.tsx
- src/components/messages/MessageSearch.tsx
- src/components/messages/NewConversationDialog.tsx

### `useClientForecast` (4)
- src/components/forecast/ForecastCard.tsx
- src/components/forecast/ForecastEmployeeTable.tsx
- src/components/forecast/ForecastKpiCards.tsx
- src/pages/ClientForecastDetail.tsx

### `useClientPeriodComparison` (1)
- src/components/salary/ClientDBTab.tsx

### `useCoachingTemplates` (2)
- src/components/coaching/CoachingFeedbackModal.tsx
- src/pages/admin/CoachingTemplates.tsx

### `useCodeOfConduct` (6)
- src/components/code-of-conduct/CodeOfConductReminderPopup.tsx
- src/components/layout/AppSidebar.tsx
- src/components/layout/LockOverlays.tsx
- src/hooks/useCodeOfConductReminder.ts
- src/pages/CodeOfConduct.tsx
- src/pages/CodeOfConductAdmin.tsx

### `useCodeOfConductReminder` (1)
- src/components/code-of-conduct/CodeOfConductReminderPopup.tsx

### `useCpoRevenue` (3)
- src/components/salary/ClientDBTab.tsx
- src/components/salary/DBDailyBreakdown.tsx
- src/components/salary/DBOverviewTab.tsx

### `useDashboardAggregates` (1)
- src/hooks/useCelebrationData.ts

### `useDashboardKpiData` (1)
- src/pages/dashboards/DesignDashboard.tsx

### `useDashboardSalesData` (1)
- src/hooks/useKpiGateway.ts

### `useDesignTypes` (3)
- src/components/dashboard/AIDashboardWizard.tsx
- src/components/dashboard/DesignSettingsTab.tsx
- src/pages/dashboards/DesignDashboard.tsx

### `useEconomicData` (7)
- src/components/economic/BaselineFilter.tsx
- src/components/economic/EconomicTopLists.tsx
- src/pages/economic/EconomicBudget.tsx
- src/pages/economic/EconomicDashboard.tsx
- src/pages/economic/EconomicExpenses.tsx
- src/pages/economic/EconomicMapping.tsx
- src/pages/economic/EconomicPosteringer.tsx

### `useEffectiveHourlyRate` (1)
- src/components/my-profile/SalesGoalTracker.tsx

### `useEmployeeAvatars` (1)
- src/components/league/HallOfFame.tsx

### `useEmployeeClientAssignments` (1)
- src/components/employees/TeamAssignEmployeesSubTab.tsx

### `useEmployeeDashboards` (1)
- src/pages/dashboards/DesignDashboard.tsx

### `useEmployeeSmsConversations` (3)
- src/components/layout/AppSidebar.tsx
- src/components/messages/EmployeeSmsTab.tsx
- src/pages/Messages.tsx

### `useEmployeeTimeClocks` (2)
- src/components/employees/TeamTimeClockTab.tsx
- src/pages/MyTimeClock.tsx

### `useEmployeeWorkingDays` (1)
- src/components/my-profile/SalesGoalTracker.tsx

### `useExtraWork` (4)
- src/components/extra-work/AddExtraWorkDialog.tsx
- src/components/extra-work/ExtraWorkHistory.tsx
- src/pages/ExtraWork.tsx
- src/pages/ExtraWorkAdmin.tsx

### `useFeatureFlag` (5)
- src/components/salary/ClientDBTab.tsx
- src/hooks/useStaffHoursCalculation.ts
- src/pages/reports/DailyReports.tsx
- src/pages/shift-planning/ShiftOverview.tsx
- src/pages/vagt-flow/VagtplanFMContent.tsx

### `useFieldmarketingEmployee` (1)
- src/components/layout/AppSidebar.tsx

### `useFieldmarketingSales` (2)
- src/pages/vagt-flow/FieldmarketingDashboard.tsx
- src/pages/vagt-flow/SalesRegistration.tsx

### `useFmBookingConflicts` (2)
- src/components/layout/AppSidebar.tsx
- src/pages/vagt-flow/BookingManagement.tsx

### `useFmChecklist` (1)
- src/pages/vagt-flow/FmChecklistContent.tsx

### `useForecastSettings` (7)
- src/components/forecast/CreateForecastDialog.tsx
- src/components/forecast/ForecastCard.tsx
- src/components/forecast/ForecastKpiCards.tsx
- src/components/forecast/ForecastSettingsPanel.tsx
- src/hooks/useClientForecast.ts
- src/pages/ClientForecast.tsx
- src/pages/ClientForecastDetail.tsx

### `useGamificationConfig` (5)
- src/components/my-profile/CompactSalesRecords.tsx
- src/components/my-profile/HeroPulseWidget.tsx
- src/components/my-profile/HeroStatusCard.tsx
- src/components/my-profile/SalesGoalTracker.tsx
- src/components/my-profile/SalesRecords.tsx

### `useGdpr` (2)
- src/components/gdpr/GdprConsentDialog.tsx
- src/components/gdpr/GdprSettingsCard.tsx

### `useGoalLock` (1)
- src/components/layout/LockOverlays.tsx

### `useHasActiveTimeClock` (1)
- src/components/layout/AppSidebar.tsx

### `useHasImmediatePaymentSales` (1)
- src/components/layout/AppSidebar.tsx

### `useIntegrationDebugLog` (1)
- src/components/debug/IntegrationDebugTab.tsx

### `useKpiDefinitions` (8)
- src/components/dashboard/AIDashboardWizard.tsx
- src/components/kpi/FormulaLiveTest.tsx
- src/components/kpi/KpiDefinitionDetail.tsx
- src/components/kpi/KpiDefinitionForm.tsx
- src/components/kpi/KpiDefinitionList.tsx
- src/components/kpi/KpiFormulaBuilder.tsx
- src/components/kpi/KpiOverview.tsx
- src/pages/admin/KpiDefinitions.tsx

### `useKpiFormulas` (3)
- src/components/dashboard/AIDashboardWizard.tsx
- src/components/kpi/KpiFormulaBuilder.tsx
- src/components/kpi/KpiOverview.tsx

### `useKpiGateway` (0)
- ⚠️ **UBRUGT** — kandidat til sletning

### `useKpiHealthMonitor` (1)
- src/hooks/useKpiGateway.ts

### `useKpiTest` (2)
- src/components/kpi/FormulaLiveTest.tsx
- src/components/kpi/KpiLiveTest.tsx

### `useKpiTypes` (2)
- src/components/dashboard/KpiSettingsTab.tsx
- src/pages/dashboards/DesignDashboard.tsx

### `useLeagueActiveData` (4)
- src/components/league/ActiveSeasonBoard.tsx
- src/components/league/LeagueMotivationBar.tsx
- src/components/league/RoundResultsCard.tsx
- src/pages/CommissionLeague.tsx

### `useLeagueData` (10)
- src/components/home/CompactLeagueView.tsx
- src/components/league/LeagueAnnouncementPopup.tsx
- src/components/league/LeagueMotivationBar.tsx
- src/components/league/LeaguePromoCard.tsx
- src/components/league/MyQualificationStatus.tsx
- src/components/league/QualificationBoard.tsx
- src/components/league/SeasonManagerCard.tsx
- src/components/league/SeasonSettingsDialog.tsx
- src/pages/CommissionLeague.tsx
- src/pages/Home.tsx

### `useLeaguePrizeData` (3)
- src/components/league/HallOfFame.tsx
- src/components/league/PrizeShowcase.tsx
- src/pages/CommissionLeague.tsx

### `useLeagueRoundProvision` (1)
- src/pages/CommissionLeague.tsx

### `useLeagueTodayProvision` (1)
- src/pages/CommissionLeague.tsx

### `useLeagueWeeklyProvision` (1)
- src/pages/CommissionLeague.tsx

### `useLogContractAccess` (2)
- src/pages/ContractSign.tsx
- src/pages/Contracts.tsx

### `useLogSensitiveAccess` (2)
- src/pages/EmployeeDetail.tsx
- src/pages/MyProfile.tsx

### `useLoginLog` (1)
- src/pages/LoginLog.tsx

### `useMfa` (4)
- src/components/layout/LockOverlays.tsx
- src/components/layout/MfaLockOverlay.tsx
- src/components/mfa/MfaSetupDialog.tsx
- src/components/mfa/MfaVerifyDialog.tsx

### `useMgTestMutationSync` (2)
- src/components/mg-test/PricingRuleEditor.tsx
- src/components/mg-test/ProductPricingRulesDialog.tsx

### `useMgTestRealtimeSync` (1)
- src/App.tsx

### `useMsalAuth` (1)
- src/hooks/useCalendarBooking.ts

### `useNormalizedSalesData` (0)
- ⚠️ **UBRUGT** — kandidat til sletning

### `useOnboarding` (15)
- src/components/coaching/CoachingFeedbackModal.tsx
- src/components/home/CompactLeagueView.tsx
- src/components/league/LeaguePromoCard.tsx
- src/components/onboarding/DrillEditDialog.tsx
- src/components/onboarding/EditDayDialog.tsx
- src/components/onboarding/OnboardingCourseContent.tsx
- src/components/onboarding/OnboardingJourneyColumn.tsx
- src/components/onboarding/OnboardingStatusBoard.tsx
- src/pages/admin/CoachingTemplates.tsx
- src/pages/economic/SalesValidation.tsx
- src/pages/onboarding/DrillLibrary.tsx
- src/pages/onboarding/EmployeeOnboardingView.tsx
- src/pages/onboarding/LeaderOnboardingView.tsx
- src/pages/onboarding/MyFeedback.tsx
- src/pages/onboarding/OnboardingAdmin.tsx

### `usePendingContractLock` (1)
- src/components/layout/LockOverlays.tsx

### `usePerformanceThresholds` (1)
- src/components/my-profile/SalesGoalTracker.tsx

### `usePersonalSalesStats` (1)
- src/pages/MyGoals.tsx

### `usePersonalWeeklyStats` (5)
- src/components/home/DailyCommissionChart.tsx
- src/components/home/PersonalRecognitions.tsx
- src/components/league/LeagueMotivationBar.tsx
- src/pages/CommissionLeague.tsx
- src/pages/Home.tsx

### `usePositionPermissions` (24)
- src/components/RoleProtectedRoute.tsx
- src/components/absence/PendingAbsencePopup.tsx
- src/components/employees/StaffEmployeesTab.tsx
- src/components/layout/AppSidebar.tsx
- src/components/vagt-flow/EditBookingDialog.tsx
- src/contexts/TwilioDeviceContext.tsx
- src/pages/CodeOfConductAdmin.tsx
- src/pages/Contracts.tsx
- src/pages/EmployeeDetail.tsx
- src/pages/EmployeeMasterData.tsx
- src/pages/ExtraWorkAdmin.tsx
- src/pages/Home.tsx
- src/pages/Messages.tsx
- src/pages/compliance/ComplianceOverview.tsx
- src/pages/personnel/UpcomingStarts.tsx
- src/pages/reports/DailyReports.tsx
- src/pages/shift-planning/AbsenceManagement.tsx
- src/pages/shift-planning/ShiftOverview.tsx
- src/pages/vagt-flow/BookingManagement.tsx
- src/pages/vagt-flow/BookingsContent.tsx
- src/pages/vagt-flow/LocationDetail.tsx
- src/pages/vagt-flow/Locations.tsx
- src/pages/vagt-flow/LocationsContent.tsx
- src/pages/vagt-flow/SalesRegistration.tsx

### `usePowerdagData` (3)
- src/components/powerdag/PowerdagSettings.tsx
- src/pages/dashboards/PowerdagBoard.tsx
- src/pages/dashboards/PowerdagInput.tsx

### `usePrecomputedKpi` (10)
- src/components/dashboard/ClientDashboard.tsx
- src/components/league/LeagueKpiCards.tsx
- src/components/salary/ClientDBTab.tsx
- src/hooks/useAggregatedClientCache.ts
- src/hooks/useEffectiveHourlyRate.ts
- src/pages/Dashboard.tsx
- src/pages/EmployeeMasterData.tsx
- src/pages/Home.tsx
- src/pages/dashboards/CphSalesDashboard.tsx
- src/pages/dashboards/SalesOverviewAll.tsx

### `usePreviousPeriodComparison` (1)
- src/components/my-profile/SalesGoalTracker.tsx

### `usePulseSurvey` (5)
- src/components/layout/AppSidebar.tsx
- src/components/pulse/PulseSurveyPopup.tsx
- src/hooks/usePulseSurveyLock.ts
- src/pages/PulseSurvey.tsx
- src/pages/PulseSurveyResults.tsx

### `usePulseSurveyLock` (1)
- src/components/layout/LockOverlays.tsx

### `useQuizTemplates` (5)
- src/components/quiz-admin/PulseSurveyEditor.tsx
- src/components/quiz-admin/QuizQuestionEditor.tsx
- src/pages/CarQuizAdmin.tsx
- src/pages/PublicPulseSurvey.tsx
- src/pages/PulseSurveyResults.tsx

### `useRecognitionKpis` (0)
- ⚠️ **UBRUGT** — kandidat til sletning

### `useReferrals` (3)
- src/pages/PublicReferralForm.tsx
- src/pages/ReferAFriend.tsx
- src/pages/recruitment/Referrals.tsx

### `useRejectedContractLock` (1)
- src/components/layout/LockOverlays.tsx

### `useRematchPricingRules` (2)
- src/components/mg-test/ProductPriceEditDialog.tsx
- src/hooks/useMgTestMutationSync.ts

### `useRequireDashboardAccess` (5)
- src/components/dashboard/ClientDashboard.tsx
- src/pages/CsTop20Dashboard.tsx
- src/pages/dashboards/CphSalesDashboard.tsx
- src/pages/dashboards/SalesOverviewAll.tsx
- src/routes/config.tsx

### `useRingingSound` (2)
- src/components/calls/CallModal.tsx
- src/components/calls/SoftphoneWidget.tsx

### `useSalesAggregates` (0)
- ⚠️ **UBRUGT** — kandidat til sletning

### `useSalesAggregatesExtended` (8)
- src/components/dashboard/ClientDashboard.tsx
- src/components/salary/ClientDBDailyBreakdown.tsx
- src/components/salary/ClientDBTab.tsx
- src/hooks/useDashboardAggregates.ts
- src/hooks/usePersonalSalesStats.ts
- src/hooks/usePreviousPeriodComparison.ts
- src/hooks/useSellerSalariesCached.ts
- src/hooks/useTeamDBStats.ts

### `useSalesGamification` (2)
- src/components/league/LeagueMotivationBar.tsx
- src/components/my-profile/SalesGoalTracker.tsx

### `useSecurityIncidents` (1)
- src/pages/compliance/SecurityIncidents.tsx

### `useSellerSalariesCached` (3)
- src/components/salary/ExportSalaryDialog.tsx
- src/components/salary/SalaryAdditionCell.tsx
- src/components/salary/SellerSalariesTab.tsx

### `useShiftPlanning` (18)
- src/components/profile/MyScheduleTabContent.tsx
- src/components/shift-planning/CreateAbsenceDialog.tsx
- src/components/shift-planning/CreateShiftDialog.tsx
- src/components/shift-planning/DeleteAbsenceDialog.tsx
- src/components/shift-planning/EditAbsenceDialog.tsx
- src/components/shift-planning/EditShiftDialog.tsx
- src/components/shift-planning/MarkSickDialog.tsx
- src/components/shift-planning/PendingAbsencesList.tsx
- src/components/shift-planning/ShiftCard.tsx
- src/components/shift-planning/TimeClock.tsx
- src/hooks/useHasActiveTimeClock.ts
- src/pages/MyTimeClock.tsx
- src/pages/reports/DailyReports.tsx
- src/pages/shift-planning/AbsenceManagement.tsx
- src/pages/shift-planning/MySchedule.tsx
- src/pages/shift-planning/ShiftOverview.tsx
- src/pages/shift-planning/TimeTracking.tsx
- src/pages/vagt-flow/VagtplanFMContent.tsx

### `useShiftResolution` (2)
- src/components/shift-planning/CreateShiftDialog.tsx
- src/hooks/useEmployeeWorkingDays.ts

### `useSidebarMenuConfig` (2)
- src/components/layout/AppSidebar.tsx
- src/pages/MenuEditor.tsx

### `useStabilityAlerts` (2)
- src/components/system-stability/AlertBanner.tsx
- src/pages/SystemStability.tsx

### `useStaffHoursCalculation` (1)
- src/components/salary/ClientDBTab.tsx

### `useSystemRoles` (2)
- src/components/layout/PreviewSidebar.tsx
- src/hooks/usePulseSurvey.ts

### `useTeamAssistantLeaders` (4)
- src/components/employees/TeamsTab.tsx
- src/components/salary/ClientDBTab.tsx
- src/components/salary/DBOverviewTab.tsx
- src/hooks/useTeamDashboardPermissions.ts

### `useTeamDBStats` (3)
- src/components/salary/CombinedSalaryTab.tsx
- src/components/salary/DBDailyBreakdown.tsx
- src/components/salary/DBOverviewTab.tsx

### `useTeamDashboardPermissions` (6)
- src/components/dashboard/DashboardHeader.tsx
- src/components/dashboard/DashboardPermissionsTab.tsx
- src/components/layout/DashboardSidebar.tsx
- src/contexts/AppModeContext.tsx
- src/hooks/useRequireDashboardAccess.ts
- src/pages/dashboards/DashboardHome.tsx

### `useTeamGoalForecast` (1)
- src/pages/TeamGoals.tsx

### `useTimeOffRequests` (1)
- src/pages/vagt-flow/TimeOffRequests.tsx

### `useTimeStamps` (4)
- src/components/profile/MyScheduleTabContent.tsx
- src/pages/MyTimeClock.tsx
- src/pages/TimeStamp.tsx
- src/pages/shift-planning/MySchedule.tsx

### `useTvBoardConfig` (1)
- src/pages/tv-board/TvBoardDirect.tsx

### `useTvCelebrationData` (1)
- src/pages/tv-board/TvBoardDirect.tsx

### `useTvScreenAdapter` (1)
- src/pages/tv-board/TvBoardDirect.tsx

### `useTwilioDevice` (4)
- src/components/calls/SoftphoneWidget.tsx
- src/contexts/TwilioDeviceContext.tsx
- src/pages/EmployeeDetail.tsx
- src/pages/EmployeeMasterData.tsx

### `useUnifiedPermissions` (16)
- src/components/dashboard/DashboardHeader.tsx
- src/components/employees/PermissionsTab.tsx
- src/components/employees/permissions/PermissionEditor.tsx
- src/components/employees/permissions/PermissionEditorV2.tsx
- src/components/employees/permissions/PermissionMap.tsx
- src/components/employees/permissions/PermissionRowWithChildren.tsx
- src/components/employees/permissions/permissionGroups.ts
- src/components/layout/DashboardSidebar.tsx
- src/config/permissionKeys.ts
- src/hooks/useTeamDashboardPermissions.ts
- src/pages/CommissionLeague.tsx
- src/pages/EmployeeMasterData.tsx
- src/pages/dashboards/PowerdagBoard.tsx
- src/pages/onboarding/OnboardingDashboard.tsx
- src/pages/recruitment/Winback.tsx
- src/pages/salary/Cancellations.tsx

### `useVagtEmployee` (2)
- src/pages/MgTest.tsx
- src/pages/vagt-flow/TimeOffRequests.tsx

### `useWeekExpectations` (4)
- src/components/onboarding/DailyMessage.tsx
- src/components/onboarding/MyProgression.tsx
- src/components/onboarding/WeekExpectationsEditor.tsx
- src/pages/onboarding/ExpectationsRamp.tsx

### `useWidgetTypes` (2)
- src/components/dashboard/WidgetSettingsTab.tsx
- src/pages/dashboards/DesignDashboard.tsx

## 6. ⚠️ Anti-pattern: Direkte Supabase-kald udenfor `hooks/`

Princip 9: *Komponenter tilgår aldrig Supabase direkte — altid via custom hook.*

**274 filer** bryder service-lag-princippet.

### `src/utils/fetchPerformance.ts`
- Tabeller: `sales`

### `src/routes/guards.tsx`
- Tabeller: `employee_master_data`, `job_positions`

### `src/pages/Agents.tsx`
- Tabeller: `agents`

### `src/pages/Auth.tsx`
- RPC: `get_auth_email_by_work_email`

### `src/pages/CarQuizAdmin.tsx`
- Tabeller: `employee_master_data`

### `src/pages/CareerWishes.tsx`
- Tabeller: `employee_master_data`, `clients`, `career_wishes`

### `src/pages/CareerWishesOverview.tsx`
- Tabeller: `career_wishes`

### `src/pages/ClientSalesOverview.tsx`
- Tabeller: `dialer_integrations`

### `src/pages/ClosingShifts.tsx`
- Tabeller: `closing_shifts`, `weekend_cleanup_config`, `teams`, `employee_master_data`, `deactivation_reminder_config`

### `src/pages/CodeOfConductAdmin.tsx`
- Tabeller: `code_of_conduct_reminders`, `employee_master_data`, `code_of_conduct_completions`, `code_of_conduct_attempts`

### `src/pages/CommissionLeague.tsx`
- RPC: `get_current_employee_id`

### `src/pages/CompanyOverview.tsx`
- Tabeller: `team_members`, `historical_employment`, `employee_master_data`, `candidates`

### `src/pages/ContractSign.tsx`
- Tabeller: `contracts`, `employee_master_data`, `contract_signatures`

### `src/pages/Contracts.tsx`
- Tabeller: `contracts`, `contract_templates`, `contract_signatures`

### `src/pages/CsTop20Dashboard.tsx`
- RPC: `get_cs_top20_custom_period_leaderboard`

### `src/pages/EmailTemplates.tsx`
- Tabeller: `email_templates`

### `src/pages/EmployeeDetail.tsx`
- Tabeller: `employee_master_data`, `clients`, `job_positions`, `employee`, `absence_request_v2`, `employee_absence`, `contracts`, `lateness_record`, `time_stamps`, `contract_signatures`

### `src/pages/EmployeeMasterData.tsx`
- Tabeller: `employee_master_data`, `job_positions`, `contracts`, `team_members`, `deactivation_reminder_config`

### `src/pages/EmployeeOnboarding.tsx`
- RPC: `get_invitation_by_token_v2`

### `src/pages/ExcelFieldMatcher.tsx`
- Tabeller: `employee_master_data`

### `src/pages/ExtraWork.tsx`
- Tabeller: `employee_master_data`, `shift`

### `src/pages/ExtraWorkAdmin.tsx`
- Tabeller: `employee_master_data`

### `src/pages/HeadToHead.tsx`
- Tabeller: `employee_basic_info`, `employee_master_data`

### `src/pages/Home.tsx`
- Tabeller: `employee_master_data`, `employee_sales_goals`, `teams`, `company_events`, `event_attendees`, `event_team_invitations`

### `src/pages/ImmediatePaymentASE.tsx`
- Tabeller: `product_pricing_rules`, `sale_items`, `employee_master_data`, `employee_agent_mapping`, `client_campaigns`, `sales`

### `src/pages/LiveStats.tsx`
- Tabeller: `clients`, `employee_master_data`, `dashboard_kpis`

### `src/pages/MgTest.tsx`
- Tabeller: `clients`, `team_clients`, `client_campaigns`, `products`, `sale_items`, `adversus_product_mappings`, `product_pricing_rules`, `master_employee`, `employee_identity`, `product_campaign_overrides`, `adversus_campaign_mappings`, `sales`, `employee`, `agents`
- RPC: `get_aggregated_product_types`

### `src/pages/MyContracts.tsx`
- Tabeller: `employee_master_data`, `contracts`

### `src/pages/MyGoals.tsx`
- Tabeller: `employee_master_data`, `absence_request_v2`, `danish_holiday`
- RPC: `get_current_employee_id`

### `src/pages/MyProfile.tsx`
- Tabeller: `employee_master_data`, `team_members`, `employee`, `absence_request_v2`, `employee_absence`, `lateness_record`, `contracts`, `time_stamps`, `booking_assignment`, `danish_holiday`, `employee_agent_mapping`, `sales`

### `src/pages/OnboardingAnalyse.tsx`
- Tabeller: `employee_master_data`, `historical_employment`, `team_members`, `sales`

### `src/pages/Permissions.tsx`
- RPC: `get_employee_roles_for_admin`

### `src/pages/PublicPulseSurvey.tsx`
- Tabeller: `pulse_surveys`, `teams`

### `src/pages/PulseSurvey.tsx`
- Tabeller: `employee_master_data`, `teams`

### `src/pages/PulseSurveyResults.tsx`
- Tabeller: `teams`

### `src/pages/RolePreview.tsx`
- Tabeller: `job_positions`, `employee_master_data`

### `src/pages/SalarySchemes.tsx`
- Tabeller: `employee_master_data`, `salary_schemes`, `employee_salary_schemes`

### `src/pages/Settings.tsx`
- Tabeller: `api_integrations`, `webhook_endpoints`, `adversus_events`, `tdc_cancellation_imports`

### `src/pages/ShortLinkRedirect.tsx`
- Tabeller: `short_links`, `short_link_clicks`

### `src/pages/SystemFeedback.tsx`
- Tabeller: `employee_master_data`, `system_feedback`, `system_feedback_comments`, `system_feedback_recipients`, `system_feedback_access`
- RPC: `is_owner`

### `src/pages/SystemStability.tsx`
- Tabeller: `dialer_integrations`, `integration_sync_runs`, `integration_logs`, `integration_schedule_audit`
- RPC: `get_active_cron_jobs`

### `src/pages/TeamGoals.tsx`
- Tabeller: `teams`, `team_monthly_goals`

### `src/pages/Teams.tsx`
- Tabeller: `teams`, `employee_master_data`

### `src/pages/UnitedDashboard.tsx`
- Tabeller: `teams`, `team_clients`, `kpi_cached_values`, `client_campaigns`, `agents`, `employee_agent_mapping`, `shift`

### `src/pages/vagt-flow/Billing.tsx`
- Tabeller: `booking`, `supplier_discount_rules`, `supplier_location_exceptions`, `teams`, `team_clients`

### `src/pages/vagt-flow/BookWeekContent.tsx`
- Tabeller: `teams`, `team_clients`, `location`, `location_placements`, `booking`

### `src/pages/vagt-flow/Bookings.tsx`
- Tabeller: `booking`, `employee_master_data`, `teams`, `team_clients`, `absence_request_v2`, `vehicle`, `vehicle_mileage`, `booking_assignment`

### `src/pages/vagt-flow/BookingsContent.tsx`
- Tabeller: `booking`, `employee_master_data`, `teams`, `team_clients`, `team_members`, `vehicle`, `booking_vehicle`, `salary_types`, `booking_diet`, `absence_request_v2`, `booking_assignment`

### `src/pages/vagt-flow/EditSalesRegistrations.tsx`
- Tabeller: `products`, `employee_master_data`, `location`, `clients`, `sale_items`, `sales`

### `src/pages/vagt-flow/FieldmarketingDashboard.tsx`
- Tabeller: `products`, `product_pricing_rules`, `employee_master_data`, `clients`

### `src/pages/vagt-flow/FmChecklistContent.tsx`
- Tabeller: `employee_master_data`

### `src/pages/vagt-flow/Index.tsx`
- Tabeller: `booking`, `location`, `employee`

### `src/pages/vagt-flow/LocationDetail.tsx`
- Tabeller: `location`, `teams`, `team_clients`, `adversus_campaign_mappings`, `client_campaigns`, `location_placements`

### `src/pages/vagt-flow/LocationHistoryContent.tsx`
- Tabeller: `booking`, `location_placements`, `booking_hotel`, `booking_diet`, `sales`, `location`

### `src/pages/vagt-flow/LocationProfitabilityContent.tsx`
- Tabeller: `booking`, `location_placements`, `booking_diet`, `booking_hotel`, `sales`

### `src/pages/vagt-flow/Locations.tsx`
- Tabeller: `location`, `teams`, `team_clients`

### `src/pages/vagt-flow/LocationsContent.tsx`
- Tabeller: `location`, `teams`, `team_clients`

### `src/pages/vagt-flow/MarketsContent.tsx`
- Tabeller: `booking`, `employee_master_data`, `teams`, `team_clients`, `team_members`, `vehicle`, `booking_assignment`, `booking_vehicle`

### `src/pages/vagt-flow/MyBookingSchedule.tsx`
- Tabeller: `employee_master_data`, `booking_assignment`, `booking_vehicle`, `booking_hotel`, `booking_diet`, `vehicle_return_confirmation`

### `src/pages/vagt-flow/SalesRegistration.tsx`
- Tabeller: `employee_master_data`, `booking_assignment`, `booking`, `location`, `products`, `client_campaigns`

### `src/pages/vagt-flow/VagtplanFMContent.tsx`
- Tabeller: `teams`, `team_members`, `lateness_record`, `time_stamps`, `team_standard_shifts`, `team_standard_shift_days`, `daily_bonus_payouts`, `employee_standard_shifts`, `booking_assignment`

### `src/pages/vagt-flow/Vehicles.tsx`
- Tabeller: `vehicle`, `vehicle_mileage`

### `src/pages/tv-board/TvBoardAdmin.tsx`
- Tabeller: `tv_board_access`

### `src/pages/tv-board/TvBoardLogin.tsx`
- Tabeller: `tv_board_access`

### `src/pages/tv-board/TvBoardView.tsx`
- Tabeller: `tv_board_access`

### `src/pages/shift-planning/AbsenceManagement.tsx`
- Tabeller: `team_members`, `teams`, `team_assistant_leaders`

### `src/pages/shift-planning/MySchedule.tsx`
- Tabeller: `team_members`, `team_standard_shifts`, `team_standard_shift_days`, `employee_standard_shifts`, `lateness_record`

### `src/pages/shift-planning/ShiftOverview.tsx`
- Tabeller: `lateness_record`, `time_stamps`, `team_members`, `team_client_daily_bonus`, `daily_bonus_payouts`, `employee_master_data`, `employee_agent_mapping`, `agents`, `sales`, `team_standard_shifts`, `team_standard_shift_days`, `employee_standard_shifts`, `absence_request_v2`

### `src/pages/shift-planning/TimeTracking.tsx`
- Tabeller: `team_members`, `time_entry`

### `src/pages/salary/Cancellations.tsx`
- Tabeller: `clients`

### `src/pages/reports/DailyReports.tsx`
- Tabeller: `teams`, `team_assistant_leaders`, `employee_basic_info`, `employee_master_data`, `team_members`, `team_clients`, `clients`, `client_campaigns`, `agents`, `employee_agent_mapping`, `absence_request_v2`, `team_standard_shifts`, `team_standard_shift_days`, `time_stamps`, `adversus_campaign_mappings`, `product_pricing_rules`, `products`
- RPC: `get_distinct_agent_emails_for_client`

### `src/pages/reports/LocationReportTab.tsx`
- Tabeller: `location`, `booking`

### `src/pages/reports/ReportsAdmin.tsx`
- Tabeller: `teams`, `employee_master_data`, `clients`, `client_campaigns`

### `src/pages/reports/ReportsManagement.tsx`
- RPC: `get_sales_report_detailed`, `get_sales_report_raw`

### `src/pages/reports/RevenueByClient.tsx`
- Tabeller: `client_adjustment_percents`, `clients`, `sale_items`, `adversus_campaign_mappings`, `product_pricing_rules`, `booking`

### `src/pages/recruitment/BookingFlow.tsx`
- Tabeller: `booking_flow_enrollments`, `booking_flow_touchpoints`, `candidates`, `booking_notification_recipients`, `booking_flow_steps`

### `src/pages/recruitment/BookingFlowEngagement.tsx`
- Tabeller: `booking_flow_enrollments`, `booking_flow_touchpoints`, `short_links`, `short_link_clicks`, `candidates`, `communication_logs`

### `src/pages/recruitment/CandidateDetail.tsx`
- Tabeller: `candidates`, `communication_logs`, `call_records`, `employee_master_data`, `cohort_members`

### `src/pages/recruitment/Candidates.tsx`
- Tabeller: `candidates`, `call_records`, `communication_logs`

### `src/pages/recruitment/EmailTemplates.tsx`
- Tabeller: `email_templates`

### `src/pages/recruitment/Messages.tsx`
- Tabeller: `communication_logs`, `call_records`, `candidates`

### `src/pages/recruitment/PublicCandidateBooking.tsx`
- Tabeller: `booking_page_content`, `booking_page_config`

### `src/pages/recruitment/PublicUnsubscribe.tsx`
- Tabeller: `booking_page_content`, `candidates`

### `src/pages/recruitment/RecruitmentDashboard.tsx`
- Tabeller: `employee_referrals`, `candidates`, `communication_logs`

### `src/pages/recruitment/Referrals.tsx`
- Tabeller: `employee_master_data`

### `src/pages/recruitment/SmsTemplates.tsx`
- Tabeller: `sms_templates`

### `src/pages/recruitment/UpcomingHires.tsx`
- Tabeller: `candidates`

### `src/pages/recruitment/UpcomingInterviews.tsx`
- Tabeller: `candidates`

### `src/pages/recruitment/Winback.tsx`
- Tabeller: `candidates`

### `src/pages/personnel/UpcomingStarts.tsx`
- Tabeller: `onboarding_cohorts`, `cohort_members`, `candidates`, `employee_master_data`, `agents`, `employee_agent_mapping`

### `src/pages/onboarding/LeaderOnboardingView.tsx`
- Tabeller: `employee_master_data`, `team_members`

### `src/pages/onboarding/OnboardingAdmin.tsx`
- Tabeller: `onboarding_drills`, `onboarding_days`

### `src/pages/economic/EconomicMapping.tsx`
- Tabeller: `economic_fordelingsregler`

### `src/pages/economic/EconomicRevenueMatch.tsx`
- Tabeller: `economic_client_mapping`, `clients`, `economic_posteringer`
- RPC: `get_sales_aggregates_v2`

### `src/pages/economic/SalesValidation.tsx`
- Tabeller: `clients`, `sales_validation_uploads`, `client_campaigns`, `sale_items`, `sales`

### `src/pages/dashboards/CphSalesDashboard.tsx`
- Tabeller: `candidates`, `onboarding_cohorts`, `cohort_members`, `sales`, `client_campaigns`, `clients`, `employee_master_data`, `absence_request_v2`, `team_clients`, `team_members`, `sale_items`
- RPC: `get_team_performance_summary`

### `src/pages/dashboards/DashboardHome.tsx`
- Tabeller: `employee_master_data`

### `src/pages/dashboards/DashboardSettings.tsx`
- Tabeller: `dashboard_kpis`

### `src/pages/dashboards/PowerdagInput.tsx`
- Tabeller: `powerdag_point_rules`

### `src/pages/dashboards/SalesOverviewAll.tsx`
- Tabeller: `kpi_cached_values`, `clients`, `employee_master_data`

### `src/pages/compliance/AiGovernance.tsx`
- Tabeller: `ai_governance_roles`, `ai_use_case_registry`, `ai_instruction_log`, `employee_master_data`

### `src/pages/compliance/ComplianceNotifications.tsx`
- Tabeller: `compliance_notification_recipients`, `agents`

### `src/pages/compliance/ContractAccessLog.tsx`
- Tabeller: `contract_access_log`, `employee_master_data`, `contracts`

### `src/pages/compliance/EmployeePrivacy.tsx`
- Tabeller: `employee_master_data`

### `src/pages/compliance/InternalProcesses.tsx`
- Tabeller: `employee_master_data`

### `src/pages/compliance/RetentionPolicies.tsx`
- Tabeller: `client_campaigns`, `campaign_retention_policies`, `data_retention_policies`, `gdpr_cleanup_log`

### `src/pages/compliance/SensitiveAccessLog.tsx`
- Tabeller: `sensitive_data_access_log`, `employee_master_data`

### `src/pages/boards/SalesDashboard.tsx`
- RPC: `get_client_sales_stats`

### `src/pages/amo/AmoAnnualDiscussion.tsx`
- Tabeller: `amo_annual_discussions`

### `src/pages/amo/AmoApv.tsx`
- Tabeller: `amo_apv`, `amo_workplaces`

### `src/pages/amo/AmoAuditLog.tsx`
- Tabeller: `amo_audit_log`

### `src/pages/amo/AmoDashboard.tsx`
- Tabeller: `amo_meetings`, `amo_annual_discussions`, `amo_apv`, `amo_kemi_apv`, `amo_amr_elections`, `amo_training_courses`, `amo_members`, `amo_tasks`, `amo_documents`

### `src/pages/amo/AmoDocuments.tsx`
- Tabeller: `amo_documents`

### `src/pages/amo/AmoKemiApv.tsx`
- Tabeller: `amo_kemi_apv`

### `src/pages/amo/AmoMeetings.tsx`
- Tabeller: `amo_meetings`

### `src/pages/amo/AmoOrganisation.tsx`
- Tabeller: `amo_workplaces`, `amo_members`, `amo_amr_elections`

### `src/pages/amo/AmoSettings.tsx`
- Tabeller: `amo_compliance_rules`

### `src/pages/amo/AmoTasks.tsx`
- Tabeller: `amo_tasks`, `amo_members`

### `src/pages/amo/AmoTraining.tsx`
- Tabeller: `amo_training_courses`, `amo_members`

### `src/pages/admin/EconomicUpload.tsx`
- Tabeller: `economic_imports`

### `src/pages/admin/SecurityDashboard.tsx`
- Tabeller: `job_positions`, `employee_master_data`, `failed_login_attempts`, `trusted_ip_ranges`

### `src/lib/resolveHoursSource.ts`
- Tabeller: `employee_time_clocks`

### `src/lib/calculations/fmPricing.ts`
- Tabeller: `products`, `product_pricing_rules`

### `src/contexts/SessionTimeoutContext.tsx`
- Tabeller: `employee_master_data`, `job_positions`

### `src/components/vagt-flow/AddEmployeeDialog.tsx`
- Tabeller: `absence_request_v2`, `booking_assignment`, `teams`, `team_standard_shifts`, `team_standard_shift_days`, `employee_standard_shifts`, `shift`

### `src/components/vagt-flow/BookingsLast30DaysChart.tsx`
- Tabeller: `booking`

### `src/components/vagt-flow/CapacityPanel.tsx`
- Tabeller: `teams`, `team_clients`, `team_members`, `employee_master_data`, `employee_standard_shifts`, `team_standard_shift_days`, `absence_request_v2`, `booking`

### `src/components/vagt-flow/EditBookingDialog.tsx`
- Tabeller: `teams`, `team_clients`, `client_campaigns`, `location_placements`, `absence_request_v2`, `booking_assignment`, `booking_vehicle`, `salary_types`, `booking_diet`, `team_standard_shifts`, `team_standard_shift_days`, `employee_standard_shifts`, `shift`, `booking`, `location`

### `src/components/system-stability/DataHealthChecks.tsx`
- Tabeller: `sales`, `sale_items`
- RPC: `get_sales_without_items_count`

### `src/components/system-stability/LiveCronStatus.tsx`
- RPC: `get_active_cron_jobs`

### `src/components/system-stability/WebhookActivity.tsx`
- Tabeller: `integration_logs`, `adversus_events`

### `src/components/shift-planning/CreateShiftDialog.tsx`
- Tabeller: `team_members`, `team_standard_shifts`, `team_standard_shift_days`

### `src/components/shift-planning/EditTimeStampDialog.tsx`
- Tabeller: `employee_client_assignments`, `time_stamps`

### `src/components/shift-planning/MissingShiftsAlert.tsx`
- Tabeller: `employee_agent_mapping`, `agents`, `team_memberships`, `team_standard_shifts`, `team_standard_shift_days`, `sales`

### `src/components/settings/DialerIntegrations.tsx`
- Tabeller: `dialer_integrations`, `dialer_calls`, `sales`

### `src/components/settings/IntegrationLogs.tsx`
- Tabeller: `integration_logs`

### `src/components/settings/SyncSingleSaleDialog.tsx`
- Tabeller: `sales`
- RPC: `search_sales`

### `src/components/sales/SalesFeed.tsx`
- Tabeller: `sales`
- RPC: `get_distinct_sales_sources`, `search_sales`

### `src/components/salary/AddPersonnelDialog.tsx`
- Tabeller: `employee_master_data`, `personnel_salaries`

### `src/components/salary/AddSalaryAdditionDialog.tsx`
- Tabeller: `salary_additions`

### `src/components/salary/AddTeamExpenseDialog.tsx`
- Tabeller: `team_expenses`

### `src/components/salary/AssistantSalary.tsx`
- Tabeller: `personnel_salaries`

### `src/components/salary/ClientDBDailyBreakdown.tsx`
- Tabeller: `booking`

### `src/components/salary/ClientDBTab.tsx`
- Tabeller: `client_adjustment_percents`, `clients`, `booking`, `team_expenses`, `personnel_salaries`, `salary_types`, `teams`, `team_members`, `team_assistant_leaders`, `kpi_cached_values`

### `src/components/salary/CombinedSalaryTab.tsx`
- Tabeller: `employee_master_data`, `employee_agent_mapping`, `personnel_salaries`

### `src/components/salary/CreateAIExpenseDialog.tsx`
- Tabeller: `team_expenses`

### `src/components/salary/DBDailyBreakdown.tsx`
- Tabeller: `team_expenses`

### `src/components/salary/DBOverviewTab.tsx`
- Tabeller: `teams`, `employee_master_data`, `team_expenses`, `personnel_salaries`, `team_members`

### `src/components/salary/EditPersonnelDialog.tsx`
- Tabeller: `teams`, `team_clients`, `personnel_salaries`

### `src/components/salary/EditTeamExpenseDialog.tsx`
- Tabeller: `team_expenses`

### `src/components/salary/NewEmployeesTab.tsx`
- Tabeller: `employee_master_data`

### `src/components/salary/PersonnelOverviewCards.tsx`
- Tabeller: `personnel_salaries`

### `src/components/salary/SalaryAdditionCell.tsx`
- Tabeller: `salary_additions`

### `src/components/salary/SalaryDashboardKPIs.tsx`
- Tabeller: `personnel_salaries`, `employee_master_data`

### `src/components/salary/SalaryTypesTab.tsx`
- Tabeller: `employee_master_data`, `salary_type_employees`, `salary_types`

### `src/components/salary/SellerSalariesTab.tsx`
- Tabeller: `teams`

### `src/components/salary/StaffSalary.tsx`
- Tabeller: `personnel_salaries`

### `src/components/salary/TeamExpensesTab.tsx`
- Tabeller: `teams`, `team_expenses`

### `src/components/salary/TeamLeaderSalary.tsx`
- Tabeller: `personnel_salaries`, `teams`, `team_clients`

### `src/components/relatel/RelatelEventsTable.tsx`
- Tabeller: `sales`

### `src/components/recruitment/AssignCohortDialog.tsx`
- Tabeller: `onboarding_cohorts`, `teams`, `team_clients`

### `src/components/recruitment/BookingCalendarTab.tsx`
- Tabeller: `candidates`, `booking_flow_enrollments`, `booking_flow_touchpoints`

### `src/components/recruitment/BookingFlowConversationsTab.tsx`
- Tabeller: `booking_flow_enrollments`, `booking_flow_touchpoints`

### `src/components/recruitment/BookingNotificationsTab.tsx`
- Tabeller: `booking_notification_recipients`

### `src/components/recruitment/BookingPagesTab.tsx`
- Tabeller: `booking_page_content`

### `src/components/recruitment/BookingPreviewTab.tsx`
- Tabeller: `booking_page_config`, `candidates`

### `src/components/recruitment/BookingSettingsTab.tsx`
- Tabeller: `booking_settings`, `candidates`

### `src/components/recruitment/CandidateCallLogs.tsx`
- Tabeller: `communication_logs`, `call_records`

### `src/components/recruitment/CandidateCard.tsx`
- Tabeller: `candidates`

### `src/components/recruitment/CandidateChatHistory.tsx`
- Tabeller: `communication_logs`

### `src/components/recruitment/CandidateDetailDialog.tsx`
- Tabeller: `communication_logs`, `candidates`

### `src/components/recruitment/CreateEmailTemplateDialog.tsx`
- Tabeller: `email_templates`

### `src/components/recruitment/CreateReferralDialog.tsx`
- Tabeller: `employee_master_data`, `employee_referrals`

### `src/components/recruitment/FlowTemplatesTab.tsx`
- Tabeller: `booking_flow_steps`

### `src/components/recruitment/NewCandidateDialog.tsx`
- Tabeller: `candidates`

### `src/components/recruitment/RecruitmentKpiBar.tsx`
- Tabeller: `booking_flow_enrollments`, `candidates`, `booking_flow_touchpoints`

### `src/components/recruitment/ScheduledEmailsList.tsx`
- Tabeller: `scheduled_emails`

### `src/components/recruitment/SendEmailDialog.tsx`
- Tabeller: `email_templates`, `scheduled_emails`

### `src/components/recruitment/SendSmsDialog.tsx`
- Tabeller: `communication_logs`, `sms_templates`

### `src/components/profile/CareerWishesTabContent.tsx`
- Tabeller: `clients`, `career_wishes`

### `src/components/profile/MyScheduleTabContent.tsx`
- Tabeller: `team_members`, `team_standard_shifts`, `team_standard_shift_days`, `employee_standard_shifts`, `lateness_record`

### `src/components/powerdag/PowerdagSettings.tsx`
- Tabeller: `powerdag_events`, `powerdag_point_rules`

### `src/components/personnel/AddMemberDialog.tsx`
- Tabeller: `onboarding_cohorts`, `team_clients`, `candidates`, `cohort_members`

### `src/components/personnel/CreateCohortDialog.tsx`
- Tabeller: `employee_master_data`, `teams`, `team_clients`, `onboarding_cohorts`

### `src/components/personnel/EditCohortDialog.tsx`
- Tabeller: `onboarding_cohorts`

### `src/components/personnel/EditMemberClientDialog.tsx`
- Tabeller: `team_clients`, `cohort_members`

### `src/components/onboarding/DrillEditDialog.tsx`
- Tabeller: `onboarding_drills`

### `src/components/onboarding/EditDayDialog.tsx`
- Tabeller: `onboarding_days`

### `src/components/my-profile/PayrollDayByDay.tsx`
- Tabeller: `employee_agent_mapping`, `sales`, `shift`, `employee_master_data`, `booking_diet`, `daily_bonus_payouts`

### `src/components/my-profile/PayrollErrorReportDialog.tsx`
- Tabeller: `payroll_error_reports`

### `src/components/my-profile/SalesGoalTracker.tsx`
- Tabeller: `employee_sales_goals`

### `src/components/mg-test/CampaignSuggestionDialog.tsx`
- Tabeller: `sales`, `sale_items`, `adversus_product_mappings`, `products`

### `src/components/mg-test/CommissionRatesTab.tsx`
- Tabeller: `clients`, `products`, `client_campaigns`, `sale_items`, `adversus_campaign_mappings`, `product_pricing_rules`

### `src/components/mg-test/FieldDefinitionDialog.tsx`
- Tabeller: `data_field_definitions`

### `src/components/mg-test/FieldDefinitionsManager.tsx`
- Tabeller: `data_field_definitions`

### `src/components/mg-test/IntegrationMappingEditor.tsx`
- Tabeller: `dialer_integrations`, `data_field_definitions`, `integration_field_mappings`

### `src/components/mg-test/PricingRuleEditor.tsx`
- Tabeller: `product_pricing_rules`, `pricing_rule_history`

### `src/components/mg-test/ProductCampaignOverrides.tsx`
- Tabeller: `adversus_campaign_mappings`, `product_campaign_overrides`

### `src/components/mg-test/ProductMergeDialog.tsx`
- Tabeller: `client_campaigns`, `products`, `sale_items`, `product_pricing_rules`, `adversus_product_mappings`, `cancellation_product_mappings`, `cancellation_product_conditions`, `product_price_history`, `product_campaign_overrides`, `product_merge_history`
- RPC: `get_aggregated_product_types`

### `src/components/mg-test/ProductPriceEditDialog.tsx`
- Tabeller: `products`, `product_price_history`

### `src/components/mg-test/ProductPricingRulesDialog.tsx`
- Tabeller: `product_pricing_rules`, `client_campaigns`, `adversus_campaign_mappings`, `product_price_history`, `products`

### `src/components/messages/ChatView.tsx`
- Tabeller: `employee_master_data`

### `src/components/layout/AppSidebar.tsx`
- Tabeller: `employee_master_data`, `contracts`, `absence_request_v2`, `teams`, `team_members`, `h2h_challenges`, `employee_referrals`, `communication_logs`, `call_records`, `system_feedback_access`
- RPC: `get_unread_message_count`, `is_owner`

### `src/components/layout/CompleteProfileBanner.tsx`
- Tabeller: `employee_master_data`

### `src/components/layout/GoalLockOverlay.tsx`
- Tabeller: `employee_sales_goals`

### `src/components/kpi/FormulaLiveTest.tsx`
- Tabeller: `employee_master_data`, `shift`, `employee_standard_shifts`, `team_members`, `team_standard_shifts`, `team_standard_shift_days`, `absence_request_v2`

### `src/components/kpi/KpiLiveTest.tsx`
- Tabeller: `clients`, `employee_master_data`

### `src/components/kpi/PublicLinksOverview.tsx`
- Tabeller: `tv_board_access`, `pulse_surveys`, `pulse_survey_completions`, `employee_referral_lookup`

### `src/components/home/CustomerInquiryInbox.tsx`
- Tabeller: `customer_inquiries`

### `src/components/home/EditEventDialog.tsx`
- Tabeller: `teams`, `event_team_invitations`, `company_events`

### `src/components/home/EventInvitationPopup.tsx`
- Tabeller: `event_team_invitations`, `event_invitation_views`, `event_attendees`

### `src/components/home/HeadToHeadComparison.tsx`
- Tabeller: `h2h_challenges`, `employee_master_data`, `employee_basic_info`, `team_members`, `employee_agent_mapping`, `dialer_calls`, `sales`
- RPC: `get_sales_aggregates_v2`

### `src/components/h2h/H2HMatchHistory.tsx`
- Tabeller: `h2h_challenges`, `h2h_employee_stats`

### `src/components/h2h/H2HPerformanceDashboard.tsx`
- Tabeller: `h2h_employee_stats`, `h2h_challenges`

### `src/components/h2h/H2HPlayerStats.tsx`
- Tabeller: `h2h_employee_stats`, `h2h_challenges`

### `src/components/forecast/CreateForecastDialog.tsx`
- Tabeller: `teams`, `clients`

### `src/components/employees/DialerMappingTab.tsx`
- Tabeller: `employee_master_data`, `agents`, `employee_agent_mapping`, `hidden_unmapped_agents`

### `src/components/employees/EmployeeExcelImport.tsx`
- Tabeller: `employee_master_data`

### `src/components/employees/EmployeeFormDialog.tsx`
- Tabeller: `employee_master_data`

### `src/components/employees/PositionsTab.tsx`
- Tabeller: `job_positions`, `system_role_definitions`, `employee_master_data`

### `src/components/employees/SendEmployeeSmsDialog.tsx`
- Tabeller: `communication_logs`

### `src/components/employees/StaffEmployeesTab.tsx`
- Tabeller: `employee_master_data`, `job_positions`, `contracts`, `team_members`, `deactivation_reminder_config`

### `src/components/employees/TeamAssignEmployeesSubTab.tsx`
- Tabeller: `employee_client_change_log`, `clients`

### `src/components/employees/TeamLeaderTeams.tsx`
- Tabeller: `teams`

### `src/components/employees/TeamStandardShifts.tsx`
- Tabeller: `team_standard_shifts`, `team_members`, `employee_standard_shifts`, `employee_master_data`, `team_shift_breaks`, `team_standard_shift_days`

### `src/components/employees/TeamTimeClockTab.tsx`
- Tabeller: `employee_master_data`, `clients`

### `src/components/employees/TeamsTab.tsx`
- Tabeller: `teams`, `employee_master_data`, `clients`, `team_clients`, `team_members`, `team_client_daily_bonus`, `team_assistant_leaders`, `scheduled_team_changes`

### `src/components/employees/permissions/PermissionEditor.tsx`
- Tabeller: `role_page_permissions`, `system_role_definitions`, `job_positions`

### `src/components/employees/permissions/PermissionEditorV2.tsx`
- Tabeller: `role_page_permissions`, `system_role_definitions`, `job_positions`

### `src/components/employees/permissions/PermissionMap.tsx`
- Tabeller: `role_page_permissions`

### `src/components/employee/EmployeeCommissionHistory.tsx`
- Tabeller: `employee_agent_mapping`, `team_members`, `team_standard_shifts`, `team_standard_shift_days`, `employee_standard_shifts`, `time_stamps`, `absence_request_v2`

### `src/components/employee/EmployeeProfileDialog.tsx`
- Tabeller: `employee_master_data`

### `src/components/dashboard/ClientDashboard.tsx`
- Tabeller: `employee_master_data`

### `src/components/dashboard/DailyRevenueChart.tsx`
- Tabeller: `sales`, `sale_items`, `adversus_campaign_mappings`, `product_pricing_rules`

### `src/components/dashboard/RelatelProductsBoard.tsx`
- Tabeller: `client_campaigns`, `sale_items`

### `src/components/dashboard/TvBoardQuickGenerator.tsx`
- Tabeller: `tv_board_access`

### `src/components/dashboard/TvLinkEditDialog.tsx`
- Tabeller: `tv_board_access`

### `src/components/dashboard/TvLinksSettingsTab.tsx`
- Tabeller: `tv_board_access`

### `src/components/contracts/SendContractDialog.tsx`
- Tabeller: `contract_templates`, `contracts`, `contract_signatures`

### `src/components/company-overview/ChurnCalculator.tsx`
- Tabeller: `team_members`, `employee_master_data`, `historical_employment`

### `src/components/company-overview/ChurnTrendChart.tsx`
- Tabeller: `historical_employment`, `employee_master_data`, `team_members`

### `src/components/company-overview/ChurnTrendChart30Days.tsx`
- Tabeller: `historical_employment`, `employee_master_data`, `team_members`

### `src/components/company-overview/ChurnTrendChart60DaysFiltered.tsx`
- Tabeller: `historical_employment`, `employee_master_data`, `team_members`

### `src/components/company-overview/ChurnTrendChartCombined.tsx`
- Tabeller: `historical_employment`, `employee_master_data`, `team_members`

### `src/components/company-overview/HistoricalTenureStats.tsx`
- Tabeller: `historical_employment`, `employee_master_data`, `team_members`

### `src/components/company-overview/NewHireChurnKpi.tsx`
- Tabeller: `employee_master_data`, `team_members`, `historical_employment`

### `src/components/company-overview/TeamAvgTenureChart.tsx`
- Tabeller: `employee_master_data`, `team_members`, `historical_employment`

### `src/components/cancellations/AddProductSection.tsx`
- Tabeller: `sales`, `products`, `sale_items`

### `src/components/cancellations/ApprovalQueueTab.tsx`
- Tabeller: `employee_master_data`, `client_campaigns`, `products`, `cancellation_queue`, `cancellation_imports`, `cancellation_upload_configs`, `cancellation_product_conditions`, `cancellation_product_mappings`, `product_change_log`, `sale_items`, `sales`
- RPC: `rollback_cancellation_import`

### `src/components/cancellations/ApprovedTab.tsx`
- Tabeller: `cancellation_queue`, `product_change_log`, `sale_items`, `employee_master_data`

### `src/components/cancellations/CancellationDialog.tsx`
- Tabeller: `sale_items`, `sales`

### `src/components/cancellations/CancellationHistoryTable.tsx`
- Tabeller: `cancellation_imports`, `cancellation_queue`

### `src/components/cancellations/DuplicatesTab.tsx`
- Tabeller: `sales`, `client_campaigns`

### `src/components/cancellations/EditCartDialog.tsx`
- Tabeller: `sale_items`, `sales`

### `src/components/cancellations/LocateSaleDialog.tsx`
- Tabeller: `cancellation_queue`, `employee_agent_mapping`, `agents`, `employee_master_data`, `sales`

### `src/components/cancellations/ManualCancellationsTab.tsx`
- Tabeller: `client_campaigns`, `sales`

### `src/components/cancellations/MatchErrorsSubTab.tsx`
- Tabeller: `cancellation_imports`, `employee_master_data`, `employee_agent_mapping`, `agents`, `cancellation_seller_mappings`, `cancellation_upload_configs`, `client_campaigns`, `sales`, `sale_items`, `cancellation_queue`

### `src/components/cancellations/ProductAutoMatch.tsx`
- Tabeller: `cancellation_product_mappings`

### `src/components/cancellations/SellerMappingTab.tsx`
- Tabeller: `cancellation_seller_mappings`, `employee_master_data`, `cancellation_product_conditions`, `cancellation_queue`, `cancellation_imports`, `client_campaigns`, `products`

### `src/components/cancellations/UnmatchedTab.tsx`
- Tabeller: `client_campaigns`, `cancellation_queue`, `sales`, `sale_items`

### `src/components/cancellations/UploadCancellationsTab.tsx`
- Tabeller: `cancellation_upload_configs`, `cancellation_imports`, `cancellation_queue`, `employee_master_data`, `employee_agent_mapping`, `agents`, `cancellation_seller_mappings`, `client_campaigns`, `sales`, `sale_items`, `cancellation_product_conditions`, `products`, `cancellation_product_mappings`
- RPC: `rollback_cancellation_import`

### `src/components/calls/CallModal.tsx`
- Tabeller: `call_records`

### `src/components/calls/SoftphoneWidget.tsx`
- Tabeller: `employee_master_data`, `candidates`

### `src/components/calls-analytics/CallsAnalytics.tsx`
- Tabeller: `adversus_campaign_mappings`, `dialer_calls`

### `src/components/billing/DiscountRulesTab.tsx`
- Tabeller: `supplier_discount_rules`, `supplier_location_exceptions`

### `src/components/billing/ExpenseReportTab.tsx`
- Tabeller: `billing_manual_expenses`, `booking`, `supplier_discount_rules`, `supplier_location_exceptions`, `booking_hotel`

### `src/components/billing/HotelExpensesTab.tsx`
- Tabeller: `booking_hotel`

### `src/components/billing/SendToSupplierDialog.tsx`
- Tabeller: `supplier_contacts`

### `src/components/billing/SupplierContactsTab.tsx`
- Tabeller: `supplier_contacts`

### `src/components/billing/SupplierReportTab.tsx`
- Tabeller: `location`, `booking`, `supplier_discount_rules`, `supplier_location_exceptions`, `supplier_invoice_reports`

### `src/components/api-overview/ApiDataOverview.tsx`
- Tabeller: `adversus_events`, `agents`, `dialer_calls`
- RPC: `get_source_counts`

### `src/components/api-overview/EventDataTable.tsx`
- Tabeller: `adversus_events`, `sales`, `agents`, `employee_identity`, `dialer_calls`

### `src/components/adversus/CphAdversusApiTab.tsx`
- Tabeller: `api_integrations`, `adversus_events`

### `src/components/absence/PendingAbsencePopup.tsx`
- Tabeller: `employee_master_data`, `absence_request_v2`, `teams`, `team_members`
