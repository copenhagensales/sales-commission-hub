/**
 * Shared prose styles for contract content rendering.
 * Used in: admin preview (Contracts.tsx), signing page (ContractSign.tsx).
 * Keeps spacing consistent so the template always matches the final view.
 */
export const CONTRACT_PROSE_CLASSES = `
  prose prose-invert
  prose-base
  text-[15px] leading-[1.7]

  /* Document Title */
  prose-h1:text-xl prose-h1:font-bold prose-h1:text-center prose-h1:text-foreground
  prose-h1:tracking-[0.15em] prose-h1:uppercase prose-h1:mb-10 prose-h1:mt-4
  prose-h1:pb-6 prose-h1:border-b prose-h1:border-foreground/20

  /* Section Titles */
  prose-h2:text-base prose-h2:font-bold prose-h2:text-foreground
  prose-h2:tracking-wide prose-h2:uppercase
  prose-h2:mt-10 prose-h2:mb-4 prose-h2:pt-5
  prose-h2:border-t prose-h2:border-foreground/10
  prose-h2:scroll-mt-24

  /* Subsection Titles */
  prose-h3:text-[15px] prose-h3:font-semibold prose-h3:text-foreground
  prose-h3:mt-6 prose-h3:mb-3

  prose-h4:text-sm prose-h4:font-semibold prose-h4:text-muted-foreground
  prose-h4:uppercase prose-h4:tracking-wider
  prose-h4:mt-5 prose-h4:mb-2

  /* Paragraphs */
  prose-p:text-muted-foreground prose-p:leading-[1.7] prose-p:my-2
  prose-p:text-[15px]

  prose-strong:text-foreground prose-strong:font-semibold

  /* Lists */
  prose-ul:my-5 prose-ul:pl-5 prose-ul:space-y-2
  prose-ol:my-5 prose-ol:pl-0 prose-ol:space-y-3 prose-ol:list-none
  prose-li:text-muted-foreground prose-li:text-[15px] prose-li:leading-[1.7]
  prose-li:my-0

  /* Nested list indentation */
  [&_ol_ol]:pl-8 [&_ol_ol]:mt-2 [&_ol_ol]:mb-0
  [&_ul_ul]:pl-6 [&_ul_ul]:mt-2

  /* Line breaks & empty paragraphs */
  [&_br]:block
  [&_p:empty]:min-h-[1em]
  [&_p:has(br:only-child)]:min-h-[1em]
  [&_p+p]:mt-2

  /* Horizontal rules */
  [&_hr]:my-10 [&_hr]:border-foreground/10

  /* Tables */
  [&_table]:w-full [&_table]:my-6 [&_table]:text-sm
  [&_table]:border [&_table]:border-border/40 [&_table]:rounded
  [&_th]:bg-muted/30 [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-left
  [&_th]:font-semibold [&_th]:text-foreground [&_th]:text-xs
  [&_th]:uppercase [&_th]:tracking-wider [&_th]:border-b [&_th]:border-border/40
  [&_td]:px-4 [&_td]:py-2.5 [&_td]:border-b [&_td]:border-border/20
  [&_td]:text-muted-foreground [&_td]:align-top
  [&_tr:last-child_td]:border-b-0
  [&_td:first-child]:font-medium [&_td:first-child]:text-foreground

  /* Blockquotes */
  [&_blockquote]:border-l-2 [&_blockquote]:border-primary/50
  [&_blockquote]:pl-6 [&_blockquote]:ml-0 [&_blockquote]:mr-0
  [&_blockquote]:my-6 [&_blockquote]:py-3
  [&_blockquote]:bg-muted/10 [&_blockquote]:rounded-r
  [&_blockquote_p]:my-1.5 [&_blockquote_p]:text-foreground/90
  [&_blockquote_p]:text-[14px] [&_blockquote_p]:leading-relaxed
  [&_blockquote_strong]:text-foreground

  /* Definition lists */
  [&_dl]:my-5 [&_dl]:grid [&_dl]:grid-cols-[auto_1fr] [&_dl]:gap-x-6 [&_dl]:gap-y-2
  [&_dt]:font-medium [&_dt]:text-foreground [&_dt]:text-sm
  [&_dd]:text-muted-foreground [&_dd]:text-sm [&_dd]:m-0

  /* Pre blocks */
  [&_pre]:whitespace-pre-wrap [&_pre]:font-sans [&_pre]:text-sm
  [&_pre]:bg-muted/20 [&_pre]:p-5 [&_pre]:rounded [&_pre]:my-5
  [&_pre]:border [&_pre]:border-border/20 [&_pre]:leading-relaxed
`.replace(/\n\s*/g, ' ').trim();
