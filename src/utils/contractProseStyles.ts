/**
 * Shared prose styles for contract content rendering.
 * Used in: admin preview (Contracts.tsx), signing page (ContractSign.tsx).
 * Keeps spacing consistent so the template always matches the final view.
 */

const BASE_PROSE = `
  prose-base
  text-[15px] leading-[1.6]

  /* Document Title */
  prose-h1:text-xl prose-h1:font-bold prose-h1:text-center
  prose-h1:tracking-[0.15em] prose-h1:uppercase prose-h1:mb-10 prose-h1:mt-4
  prose-h1:pb-6 prose-h1:border-b

  /* Section Titles */
  prose-h2:text-base prose-h2:font-bold
  prose-h2:tracking-wide prose-h2:uppercase
  prose-h2:mt-10 prose-h2:mb-4 prose-h2:pt-5
  prose-h2:border-t
  prose-h2:scroll-mt-24

  /* Subsection Titles */
  prose-h3:text-[15px] prose-h3:font-semibold
  prose-h3:mt-6 prose-h3:mb-3

  prose-h4:text-sm prose-h4:font-semibold
  prose-h4:uppercase prose-h4:tracking-wider
  prose-h4:mt-5 prose-h4:mb-2

  /* Paragraphs */
  prose-p:leading-[1.6] prose-p:my-0.5
  prose-p:text-[15px]

  prose-strong:font-semibold

  /* Lists */
  prose-ul:my-5 prose-ul:pl-5 prose-ul:space-y-2
  prose-ol:my-5 prose-ol:pl-0 prose-ol:space-y-3 prose-ol:list-none
  prose-li:text-[15px] prose-li:leading-[1.7]
  prose-li:my-0

  /* Nested list indentation */
  [&_ol_ol]:pl-8 [&_ol_ol]:mt-2 [&_ol_ol]:mb-0
  [&_ul_ul]:pl-6 [&_ul_ul]:mt-2

  /* Line breaks & empty paragraphs */
  [&_br]:block
  [&_p:empty]:min-h-[1em]
  [&_p:has(br:only-child)]:min-h-[1em]
  [&_p+p]:mt-1

  /* Horizontal rules */
  [&_hr]:my-10

  /* Tables */
  [&_table]:w-full [&_table]:my-6 [&_table]:text-sm
  [&_table]:border [&_table]:rounded
  [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-left
  [&_th]:font-semibold [&_th]:text-xs
  [&_th]:uppercase [&_th]:tracking-wider [&_th]:border-b
  [&_td]:px-4 [&_td]:py-2.5 [&_td]:border-b
  [&_td]:align-top
  [&_tr:last-child_td]:border-b-0
  [&_td:first-child]:font-medium

  /* Blockquotes */
  [&_blockquote]:border-l-2
  [&_blockquote]:pl-6 [&_blockquote]:ml-0 [&_blockquote]:mr-0
  [&_blockquote]:my-6 [&_blockquote]:py-3
  [&_blockquote]:rounded-r
  [&_blockquote_p]:my-1.5
  [&_blockquote_p]:text-[14px] [&_blockquote_p]:leading-relaxed

  /* Definition lists */
  [&_dl]:my-5 [&_dl]:grid [&_dl]:grid-cols-[auto_1fr] [&_dl]:gap-x-6 [&_dl]:gap-y-2
  [&_dt]:font-medium [&_dt]:text-sm
  [&_dd]:text-sm [&_dd]:m-0

  /* Pre blocks */
  [&_pre]:whitespace-pre-wrap [&_pre]:font-sans [&_pre]:text-sm
  [&_pre]:p-5 [&_pre]:rounded [&_pre]:my-5
  [&_pre]:border [&_pre]:leading-relaxed
`;

/**
 * Admin preview & editor: uses design-system tokens (dark mode compatible).
 */
export const CONTRACT_PROSE_CLASSES = `
  prose prose-invert ${BASE_PROSE}
  prose-h1:text-foreground prose-h1:border-foreground/20
  prose-h2:text-foreground prose-h2:border-foreground/10
  prose-h3:text-foreground
  prose-h4:text-muted-foreground
  prose-p:text-muted-foreground
  prose-strong:text-foreground
  prose-li:text-muted-foreground
  [&_hr]:border-foreground/10
  [&_table]:border-border/40
  [&_th]:bg-muted/30 [&_th]:text-foreground [&_th]:border-border/40
  [&_td]:text-muted-foreground [&_td]:border-border/20
  [&_td:first-child]:text-foreground
  [&_blockquote]:border-primary/50 [&_blockquote]:bg-muted/10
  [&_blockquote_p]:text-foreground/90
  [&_blockquote_strong]:text-foreground
  [&_dt]:text-foreground
  [&_dd]:text-muted-foreground
  [&_pre]:bg-muted/20 [&_pre]:border-border/20
`.replace(/\n\s*/g, ' ').trim();

/**
 * Signing page: formal white paper with black text – no dark mode tokens.
 */
export const CONTRACT_PROSE_SIGN_CLASSES = `
  prose prose-neutral ${BASE_PROSE}
  [&_h1]:!text-neutral-900 [&_h1]:!border-neutral-200
  [&_h2]:!text-neutral-900 [&_h2]:!border-neutral-200
  [&_h3]:!text-neutral-900
  [&_h4]:!text-neutral-500
  [&_p]:!text-neutral-700
  [&_strong]:!text-neutral-900
  [&_li]:!text-neutral-700
  [&_hr]:!border-neutral-200
  [&_table]:!border-neutral-200
  [&_th]:!bg-neutral-50 [&_th]:!text-neutral-900 [&_th]:!border-neutral-200
  [&_td]:!text-neutral-600 [&_td]:!border-neutral-100
  [&_td:first-child]:!text-neutral-900
  [&_blockquote]:!border-neutral-300 [&_blockquote]:!bg-neutral-50
  [&_blockquote_p]:!text-neutral-700
  [&_blockquote_strong]:!text-neutral-900
  [&_dt]:!text-neutral-900
  [&_dd]:!text-neutral-600
  [&_pre]:!bg-neutral-50 [&_pre]:!border-neutral-200
  !text-neutral-700
`.replace(/\n\s*/g, ' ').trim();
