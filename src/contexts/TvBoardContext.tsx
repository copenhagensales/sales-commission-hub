import { createContext, useContext, ReactNode, useMemo } from "react";

interface TvBoardContextValue {
  overrideSlug: string | null;
}

const TvBoardContext = createContext<TvBoardContextValue>({ overrideSlug: null });

export const useTvBoardContext = () => useContext(TvBoardContext);

interface TvBoardProviderProps {
  slug: string;
  children: ReactNode;
}

export const TvBoardProvider = ({ slug, children }: TvBoardProviderProps) => {
  const value = useMemo(() => ({ overrideSlug: slug }), [slug]);
  
  return (
    <TvBoardContext.Provider value={value}>
      {children}
    </TvBoardContext.Provider>
  );
};
