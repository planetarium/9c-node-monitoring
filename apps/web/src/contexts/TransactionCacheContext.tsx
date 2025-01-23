import React, { createContext, useCallback, useContext, useRef } from "react";
import { TransactionData, TransactionCache } from "@/src/types";
import { useLoadingContext } from "@/src/contexts/LoadingContext";
import { toTimezoneDateString } from "@/src/helper";

type TransactionCacheContextType = {
  transactionCache: TransactionCache;
  fetchTransactionDataWithCache: (group: string, date: Date) => Promise<void>;
};

// Context 생성
const TransactionCacheContext = createContext<TransactionCacheContextType>({
  transactionCache: {},
  fetchTransactionDataWithCache: async () => {},
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
  const { incrementCount } = useLoadingContext();

  const transactionCacheRef = useRef<TransactionCache>({}); // 캐시 ref

  // 비동기 요청을 처리하는 함수
  // 하루가 들어올 경우 하루만 요청
  // 이틀이 들어올 경우, 연속적이지 않다는 가정 하에 나눠서 요청 (일반적으로 중앙값을 먼저 요청하므로)
  const fetchAndCacheTransactions = useCallback(
    async (group: string, dates: string[]) => {
      if (dates.length === 0) return;

      if (dates.length === 1) {
        // 단일 날짜 요청
        const startDateTime = formatKoreaDateToUTCDateTime(dates[0], "start");
        const endDateTime = formatKoreaDateToUTCDateTime(dates[0], "end");

        const response = await fetch(
          `${process.env.NEXT_API_URL}/transactions/status?group=${group}&start=${startDateTime}&end=${endDateTime}`
        );

        if (!response.ok) {
          console.error(`Error: ${response.status} - ${response.statusText}`);
          return null;
        }

        const fetchedData = await response.json();
        const groupedFetchedData = arrayToDateKeyMap(fetchedData);

        // 캐시에 저장
        if (!transactionCacheRef.current[group]) {
          transactionCacheRef.current[group] = {};
        }

        transactionCacheRef.current[group][dates[0]] =
          groupedFetchedData[dates[0]] || [];
      } else if (dates.length === 2) {
        // 두 날짜 요청
        const startDateTime1 = formatKoreaDateToUTCDateTime(dates[0], "start");
        const endDateTime1 = formatKoreaDateToUTCDateTime(dates[0], "end");

        const startDateTime2 = formatKoreaDateToUTCDateTime(dates[1], "start");
        const endDateTime2 = formatKoreaDateToUTCDateTime(dates[1], "end");

        const response = await fetch(
          `${process.env.NEXT_API_URL}/transactions/status?group=${group}&start=${startDateTime1}&end=${endDateTime1}&start2=${startDateTime2}&end2=${endDateTime2}`
        );

        if (!response.ok) {
          console.error(`Error: ${response.status} - ${response.statusText}`);
          return null;
        }

        const fetchedData = await response.json();
        const groupedFetchedData = arrayToDateKeyMap(fetchedData);

        // 캐시에 저장
        if (!transactionCacheRef.current[group]) {
          transactionCacheRef.current[group] = {};
        }

        dates.forEach((date) => {
          transactionCacheRef.current[group][date] =
            groupedFetchedData[date] || [];
        });
      }

      incrementCount();
    },
    [incrementCount]
  );

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

      // 즉시 가져올 데이터
      const immediateDates = dateKeysUntilToday.filter(
        (dateKey) =>
          dateKey === toTimezoneDateString(currentDate, 9) && // current만 가져오되,
          (dateKey === toTimezoneDateString(today, 9) || // current가 오늘이라면 무조건 가져오고
            !transactionCacheRef.current[group]?.[dateKey]) // 그렇지 않으면 캐시 여부 확인
      );

      // 천천히 가져올 데이터
      const laterDates = dateKeysUntilToday.filter(
        (dateKey) =>
          dateKey !== toTimezoneDateString(currentDate, 9) && // current가 아닌 날짜
          !transactionCacheRef.current[group]?.[dateKey] // 캐시에 없는 경우만
      );

      if (immediateDates.length > 0) {
        await fetchAndCacheTransactions(group, immediateDates);
      }

      if (laterDates.length > 0) {
        fetchAndCacheTransactions(group, laterDates); // 비동기 실행
      }
    },
    [fetchAndCacheTransactions]
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
