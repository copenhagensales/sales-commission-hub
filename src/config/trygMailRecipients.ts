/**
 * Faste modtagere af annulleringsmails fra "Tryg - Ret salg".
 * Bruges KUN til visning i dialogen — edge function
 * `send-tryg-cancellation` holder den autoritative liste
 * (edge functions kan ikke importere fra src/).
 */
export const TRYG_MAIL_RECIPIENTS: readonly string[] = [
  "jm@copenhagensales.dk",
  "fk@copenhagensales.dk",
];
