import { useCurrentEmployeeId } from "@/hooks/useCurrentEmployeeId";
import { usePulsenUnread } from "@/hooks/usePulsen";
import { useChatUnreadTotal } from "@/hooks/useChat";
import { usePermissions } from "@/hooks/usePositionPermissions";

/** Ulæste chatbeskeder (kun med adgang til Beskeder). */
export function useStorkbookChatUnread(): number {
  const { data: employeeId } = useCurrentEmployeeId();
  const { canViewMessagesPersonal } = usePermissions();
  const { data = 0 } = useChatUnreadTotal(employeeId, !!canViewMessagesPersonal);
  return data;
}

/** Storkbook-tallet: nyt i feedet + ulæste chatbeskeder. */
export function useStorkbookUnread(): number {
  const { data: employeeId } = useCurrentEmployeeId();
  const { data: feed = 0 } = usePulsenUnread(employeeId);
  return feed + useStorkbookChatUnread();
}
