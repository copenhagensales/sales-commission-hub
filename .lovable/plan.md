

# Flyt Kundehenvendelser til Ledelse-menuen

## Ændringer

### 1. Ny side: `src/pages/CustomerInquiries.tsx`
- Wrapper-side med `MainLayout` der renderer `CustomerInquiryInbox` komponenten
- Simpel side med titel

### 2. `src/components/layout/PreviewSidebar.tsx`
- Tilføj `menu_customer_inquiries` til `MANAGEMENT_ITEMS`:
  ```
  menu_customer_inquiries: { name: "Kundehenvendelser", href: "/customer-inquiries", icon: Inbox }
  ```

### 3. `src/config/permissionKeys.ts`
- Tilføj ny permission key under Ledelse-sektionen:
  ```
  menu_customer_inquiries: { label: 'Kundehenvendelser', section: 'ledelse', parent: 'menu_section_ledelse' }
  ```

### 4. `src/routes/pages.ts`
- Tilføj lazy import for `CustomerInquiries`

### 5. `src/routes/config.tsx`
- Tilføj route: `{ path: "/customer-inquiries", component: CustomerInquiries, access: "role", positionPermission: "menu_customer_inquiries" }`

### 6. `src/pages/Home.tsx`
- Fjern `CustomerInquiryInbox` og den hardcodede email-check fra home-siden

### 7. Database migration
- Seed `menu_customer_inquiries` permission for ejer-rollen med `can_view: true`

| Fil | Handling |
|-----|---------|
| `src/pages/CustomerInquiries.tsx` | Ny side |
| `src/components/layout/PreviewSidebar.tsx` | Tilføj menupunkt |
| `src/config/permissionKeys.ts` | Tilføj permission key |
| `src/routes/pages.ts` | Lazy import |
| `src/routes/config.tsx` | Tilføj route |
| `src/pages/Home.tsx` | Fjern inbox derfra |
| DB migration | Seed permission |

