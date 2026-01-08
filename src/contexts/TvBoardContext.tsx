import { createContext, useContext, ReactNode } from "react";

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
  return (
    <TvBoardContext.Provider value={{ overrideSlug: slug }}>
      {children}
    </TvBoardContext.Provider>
  );
};
