/** Props til det panel, en fane styrer: `<div {...fanePanel("mine-tal", "maal")}>` – kobles til Faner via samme `praefiks` [Codex D0]. */
export const fanePanel = (praefiks: string, id: string) => ({ id: `${praefiks}-panel-${id}`, role: "tabpanel" as const, "aria-labelledby": `${praefiks}-fane-${id}`, tabIndex: 0 });
