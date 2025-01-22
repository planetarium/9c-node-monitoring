import { createContext, useCallback, useContext, useState } from "react";

type LoadingContextType = {
  loadingCount: number;
  incrementCount: () => void;
};

const LoadingContext = createContext<LoadingContextType>({
  loadingCount: 0,
  incrementCount: () => {}, // 로딩 증가 함수
});

export const LoadingContextProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [loadingCount, setLoadingCount] = useState(0);

  const incrementCount = useCallback(() => {
    setLoadingCount((prev) => prev + 1);
  }, []);

  return (
    <LoadingContext.Provider value={{ loadingCount, incrementCount }}>
      {children}
    </LoadingContext.Provider>
  );
};

export const useLoadingContext = (): LoadingContextType => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error(
      "useLoadingContext must be used within a LoadingContextProvider"
    );
  }
  return context;
};
