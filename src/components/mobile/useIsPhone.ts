import { useEffect, useState } from "react";

/** Telefongrænse fra mobilstandarden. */
export const PHONE_MAX = 767;

/** Sand på < 768 px. Beregnes synkront ved første render, så telefonen ikke blinker med computerlayout. */
export function useIsPhone(): boolean {
  const query = `(max-width: ${PHONE_MAX}px)`;
  const [isPhone, setIsPhone] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setIsPhone(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return isPhone;
}
