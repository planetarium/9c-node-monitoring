import React, { createContext, useContext, useMemo } from "react";

type TimeZoneContextType = {
  userTimeZone: string; // 사용자의 타임존
};

const TimeZoneContext = createContext<TimeZoneContextType | null>(null);

export const TimeZoneContextProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  // 사용자의 타임존을 가져옵니다. 이 값은 한 번만 계산됩니다.
  const userTimeZone = useMemo(() => {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }, []);

  return (
    <TimeZoneContext.Provider value={{ userTimeZone }}>
      {children}
    </TimeZoneContext.Provider>
  );
};

export const useTimeZoneContext = (): TimeZoneContextType => {
  const context = useContext(TimeZoneContext);
  if (!context) {
    throw new Error(
      "useTimeZoneContext must be used within a TimeZoneContextProvider"
    );
  }
  return context;
};
