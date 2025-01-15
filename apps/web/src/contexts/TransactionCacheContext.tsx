import React, { createContext, useCallback, useContext, useRef } from "react";
import { TransactionData, TransactionCache } from "@/src/types";
import { useLoadingContext } from "@/src/contexts/LoadingContext";
import { toTimezoneDateString } from "@/src/helper";

type TransactionCacheContextType = {
  transactionCache: TransactionCache;
  fetchTransactionDataWithCache: (
    group: string,
    date: Date
  ) => Promise<Record<string, TransactionData[]> | null>;
};

// Context 생성
const TransactionCacheContext = createContext<TransactionCacheContextType>({
  transactionCache: {},
  fetchTransactionDataWithCache: async () => null,
});

type TransactionCacheProviderProps = {
  children: React.ReactNode;
};

// 한국 시간 기준의 00:00:00 또는 23:59:59를 UTC로 변환
const formatKoreaDateToUTCDateTime = (date: string, start: string): string => {
  //date는 "YYYY-MM-DD" 형태
  const adjustedDate = new Date(`${date}T00:00:00+09:00`); // 한국 시간 기준 00:00:00로 시간 생성

  if (start === "start") {
    adjustedDate.setHours(0, 0, 0, 0);
  } else {
    adjustedDate.setHours(23, 59, 59, 999);
  }

  return adjustedDate.toISOString(); // 최종 UTC 시간 문자열 반환
};

const arrayToDateKeyMap = (
  data: TransactionData[]
): Record<string, TransactionData[]> => {
  return data.reduce((acc, item) => {
    const dateKey = toTimezoneDateString(new Date(item.timeStamp), 9); // `timeStamp`를 한국 시간 기준 `YYYY-MM-DD`로 변환
    if (!acc[dateKey]) {
      acc[dateKey] = []; // 해당 날짜가 없으면 배열 초기화
    }
    acc[dateKey].push(item); // 날짜별로 데이터를 배열에 추가
    return acc;
  }, {} as Record<string, TransactionData[]>);
};

export const TransactionCacheProvider = ({
  //TODO 추가로 odin, heimdal 둘 다 캐시하고 있으니 성능상 필요하다면 한 쪽만 캐시하도록 수정
  children,
}: TransactionCacheProviderProps) => {
  const { setIsLoading } = useLoadingContext();

  const transactionCacheRef = useRef<TransactionCache>({}); // 캐시 ref

  const fetchTransactionDataWithCache = useCallback(
    //todo: usecallback 써야하나?
    async (group: string, date: Date) => {
      //console.log("fetchTransactionDataWithCache", group, date);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // 한국 시간 기준 오늘 00:00:00

      const prevDate = new Date(date.getTime() - 24 * 60 * 60 * 1000);
      prevDate.setHours(0, 0, 0, 0); // 한국 시간 기준 전날  00:00:00
      const currentDate = new Date(date.getTime());
      currentDate.setHours(0, 0, 0, 0); // 한국 시간 기준 오늘 00:00:00
      const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);
      nextDate.setHours(0, 0, 0, 0); // 한국 시간 기준 다음날 00:00:00

      //console.log("prevDate", prevDate);
      //console.log("nextDate", nextDate);

      const dateKeysUntilToday = [prevDate, currentDate, nextDate]
        .filter((d) => d <= today)
        .map((d) => toTimezoneDateString(d, 9));

      //console.log("dateKeysUntilToday", dateKeysUntilToday);

      const datesToFetch = dateKeysUntilToday.filter(
        (dateKey) =>
          !transactionCacheRef.current[dateKey] ||
          (dateKey === toTimezoneDateString(today, 9) &&
            toTimezoneDateString(currentDate, 9) ===
              toTimezoneDateString(today, 9)) //오늘 데이터인 경우 fetch 포함
      );

      if (datesToFetch.length === 0) {
        return dateKeysUntilToday.reduce<Record<string, TransactionData[]>>(
          (acc, key) => {
            acc[key] = transactionCacheRef.current[key];
            return acc;
          },
          {}
        );
      }

      // 해당 날짜의 범위를 UTC로 변환해 API 요청
      const startDateTime = formatKoreaDateToUTCDateTime(
        datesToFetch[0],
        "start"
      ); // 00:00:00
      const endDateTime = formatKoreaDateToUTCDateTime(
        datesToFetch[datesToFetch.length - 1],
        "end"
      ); // 23:59:59

      const response = await fetch(
        `${process.env.NEXT_API_URL}/transactions/status?group=${group}&start=${startDateTime}&end=${endDateTime}`
      );

      if (!response.ok) {
        console.error(`Error: ${response.status} - ${response.statusText}`);
        return null;
      }

      const fetchedData = await response.json();

      // 배열 데이터를 날짜별로 그룹화
      const groupedFetchedData = arrayToDateKeyMap(fetchedData);

      // 캐시에 저장
      datesToFetch.forEach((date) => {
        if (!transactionCacheRef.current[date]) {
          transactionCacheRef.current[date] = [];
        }
        transactionCacheRef.current[date] = groupedFetchedData[date] || [];
      });

      setIsLoading(false);
      return fetchedData;
    },
    [setIsLoading]
  );

  return (
    <TransactionCacheContext.Provider
      value={{
        transactionCache: transactionCacheRef.current,
        fetchTransactionDataWithCache,
      }}
    >
      {children}
    </TransactionCacheContext.Provider>
  );
};

// useTransactionCache Hook
export const useTransactionCache = (): TransactionCacheContextType => {
  const context = useContext(TransactionCacheContext);
  if (!context) {
    throw new Error(
      "useTransactionCache must be used within a TransactionCacheProvider"
    );
  }
  return context;
};
